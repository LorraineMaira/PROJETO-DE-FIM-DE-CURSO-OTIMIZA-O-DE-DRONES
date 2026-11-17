#!/usr/bin/env python3
"""API HTTP do FireDrone 

O cálculo roda no MESMO motor JavaScript da interface (../core), executado por `node runner.js`.
Requisitos: Python 3.9+ e Node.js 18+.

    python app.py [--port 8000] [--host 127.0.0.1]

Endpoints (JSON):
    GET  /api/health
    GET  /api/catalog                    drones, cenários (combustíveis) com valores padrão, faixas de incerteza
    POST /api/resolve   {fuel_index, overrides, full}      resolução espacial/temporal escolhida pelo código
    POST /api/jobs      {pedido de execução}               inicia uma execução em segundo plano -> {id}
    GET  /api/jobs/<id>                                    estado, progresso e, ao terminar, o resultado
    DELETE /api/jobs/<id>                                  cancela
    POST /api/run       {pedido de execução}               executa e espera (para scripts; pode demorar minutos)
    GET  /                                                 interface (../frontend/index.html)

Pedido de execução (todos opcionais): fuel_index (0..12), overrides {area,a0,wind,wdir,slope,sdir,rh,temp,bdist,brel,delay,maxloss,
opsyr,life,fixop,wcost}, n (frota máxima), model (-1 = comparar todos), compare, tactic (auto|direto|flancos|indireto|cercamento),
objective (custo|capex|drones), rigor (mc|det), alpha (prob. mínima de contenção, 0.5..0.99), K (réplicas por teste), unc {param: faixa},
custom_models [{name,pay,v,end,cx,[rf,ox,mtow,empty]}], mc_replicas (distribuição final; 0 desliga), tornado (bool), threads.
"""
import argparse, json, os, shutil, subprocess, sys, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
RUNNER = HERE / "runner.js"
FRONT = HERE.parent / "frontend"
NODE = os.environ.get("NODE", "node")
MAX_JOBS = int(os.environ.get("FIREDRONE_MAX_JOBS", "2"))   # execuções simultâneas (cada uma usa todos os núcleos)
JOBS: dict = {}
LOCK = threading.Lock()
SLOTS = threading.BoundedSemaphore(MAX_JOBS)


def node_ok():
    exe = shutil.which(NODE)
    if not exe:
        return False, f"Node.js não encontrado ('{NODE}'). Instale o Node 18+ (https://nodejs.org) ou defina a variável NODE."
    try:
        v = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=10).stdout.strip()
        if int(v.lstrip("v").split(".")[0]) < 18:
            return False, f"Node {v} é antigo; use 18 ou superior."
        return True, v
    except Exception as e:  # pragma: no cover
        return False, str(e)


def call(req: dict, timeout=None):
    """Executa um pedido curto (catalog/resolve) e devolve o resultado."""
    p = subprocess.run([NODE, str(RUNNER)], input=json.dumps(req), capture_output=True, text=True, timeout=timeout, cwd=str(HERE))
    last = None
    for line in p.stdout.splitlines():
        try:
            last = json.loads(line)
        except ValueError:
            pass
    if not last:
        raise RuntimeError(p.stderr.strip() or "sem resposta do motor")
    if last.get("type") == "error":
        raise ValueError(last["message"])
    return last["data"]


def run_job(job):
    with SLOTS:
        if job["status"] == "cancelled":
            return
        job["status"], job["t0"] = "running", time.time()
        try:
            proc = subprocess.Popen([NODE, str(RUNNER)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, cwd=str(HERE))
            job["proc"] = proc
            proc.stdin.write(json.dumps(job["request"])); proc.stdin.close()
            for line in proc.stdout:
                try:
                    m = json.loads(line)
                except ValueError:
                    continue
                if m["type"] == "progress":
                    job["progress"] = {"frac": m["frac"], "text": m["text"]}
                elif m["type"] == "result":
                    job["result"] = m["data"]
                elif m["type"] == "error":
                    job["error"] = m["message"]
            proc.wait()
            if job["status"] == "cancelled":
                return
            job["status"] = "done" if job.get("result") is not None else "error"
            if job["status"] == "error" and "error" not in job:
                job["error"] = (proc.stderr.read() or "o motor terminou sem resultado")[-2000:]
        except Exception as e:  # pragma: no cover
            job["status"], job["error"] = "error", str(e)
        finally:
            job["t1"] = time.time()


def new_job(req):
    job = {"id": uuid.uuid4().hex[:12], "status": "queued", "request": req, "progress": {"frac": 0, "text": "na fila"}, "created": time.time()}
    with LOCK:
        JOBS[job["id"]] = job
        for k in [k for k, j in JOBS.items() if j.get("t1") and time.time() - j["t1"] > 3600]:   # limpa jobs antigos
            JOBS.pop(k, None)
    threading.Thread(target=run_job, args=(job,), daemon=True).start()
    return job


def view(job, with_result=True):
    t0 = job.get("t0")
    d = {"id": job["id"], "status": job["status"], "progress": job["progress"], "elapsed_s": round((job.get("t1") or time.time()) - t0, 1) if t0 else 0}
    if job.get("error"):
        d["error"] = job["error"]
    if with_result and job["status"] == "done":
        d["result"] = job["result"]
    return d


class H(BaseHTTPRequestHandler):
    server_version = "FireDrone/6"

    def log_message(self, fmt, *a):
        if os.environ.get("FIREDRONE_LOG"):
            super().log_message(fmt, *a)

    def send(self, code, obj, ctype="application/json; charset=utf-8"):
        body = obj if isinstance(obj, bytes) else json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*"); self.send_header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS"); self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers(); self.wfile.write(body)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b"{}"
        try:
            return json.loads(raw or b"{}")
        except ValueError:
            raise ValueError("corpo não é JSON válido")

    def do_OPTIONS(self):
        self.send(204, b"")

    def do_GET(self):
        path = urlparse(self.path).path
        try:
            if path == "/api/health":
                ok, info = node_ok(); return self.send(200, {"ok": ok, "node": info, "jobs": len(JOBS)})
            if path == "/api/catalog":
                return self.send(200, call({"op": "catalog"}, 60))
            if path.startswith("/api/jobs/"):
                j = JOBS.get(path.rsplit("/", 1)[1])
                return self.send(200, view(j)) if j else self.send(404, {"error": "job não encontrado"})
            if path in ("/", "/index.html"):
                f = FRONT / "index.html"
                return self.send(200, f.read_bytes(), "text/html; charset=utf-8") if f.exists() else self.send(404, {"error": "frontend/index.html não encontrado"})
            self.send(404, {"error": "rota não encontrada"})
        except ValueError as e:
            self.send(400, {"error": str(e)})
        except Exception as e:
            self.send(500, {"error": str(e)})

    def do_DELETE(self):
        path = urlparse(self.path).path
        j = JOBS.get(path.rsplit("/", 1)[1]) if path.startswith("/api/jobs/") else None
        if not j:
            return self.send(404, {"error": "job não encontrado"})
        j["status"] = "cancelled"
        if j.get("proc"):
            j["proc"].kill()
        self.send(200, view(j, False))

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            b = self.body()
            if path == "/api/resolve":
                return self.send(200, call({"op": "resolve", "fuel_index": b.get("fuel_index", 1), "overrides": b.get("overrides", {}), "full": b.get("full", False)}, 120))
            if path == "/api/jobs":
                b["op"] = "run"; return self.send(202, view(new_job(b), False))
            if path == "/api/run":
                b["op"] = "run"; j = new_job(b)
                while j["status"] in ("queued", "running"):
                    time.sleep(.5)
                return self.send(200 if j["status"] == "done" else 400, view(j))
            self.send(404, {"error": "rota não encontrada"})
        except ValueError as e:
            self.send(400, {"error": str(e)})
        except Exception as e:
            self.send(500, {"error": str(e)})


def main():
    ap = argparse.ArgumentParser(description="API do FireDrone")
    ap.add_argument("--host", default="127.0.0.1"); ap.add_argument("--port", type=int, default=8000)
    a = ap.parse_args()
    ok, info = node_ok()
    if not ok:
        sys.exit("ERRO: " + info)
    print(f"FireDrone: Node {info} · http://{a.host}:{a.port}/  (interface)  ·  /api/catalog  /api/jobs  /api/run", flush=True)
    ThreadingHTTPServer((a.host, a.port), H).serve_forever()


if __name__ == "__main__":
    main()
