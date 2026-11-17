#!/usr/bin/env python3
"""Testes da API (somente biblioteca padrão). Uso: python test_api.py   (precisa de Node 18+)"""
import json, sys, threading, time, unittest, urllib.request, urllib.error
from http.server import ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
import app  # noqa: E402


def http(method, url, body=None):
    req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), method=method, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


class T(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = ThreadingHTTPServer(("127.0.0.1", 0), app.H)
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        _, cat = http("GET", cls.base + "/api/catalog")
        cls.cat = cat
        cls.h32 = [d["name"] for d in cat["drones"]].index("Spider H32X")

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_health(self):
        c, d = http("GET", self.base + "/api/health")
        self.assertEqual(c, 200); self.assertTrue(d["ok"])

    def test_catalog(self):
        self.assertGreaterEqual(len(self.cat["drones"]), 20); self.assertGreaterEqual(len(self.cat["fuels"]), 10)
        self.assertTrue(any(d["pay"] >= 100 for d in self.cat["drones"]), "deve haver drone de 100 L (Spider H300)")
        self.assertEqual(len(self.cat["uncertainties"]), 15)

    def test_resolve_is_chosen_by_code(self):
        c, d = http("POST", self.base + "/api/resolve", {"fuel_index": 1})
        self.assertEqual(c, 200); self.assertLessEqual(d["N"], 200); self.assertGreaterEqual(d["cs"], 10); self.assertTrue(d["rows"])

    def test_run_fixed_fleet(self):
        c, d = http("POST", self.base + "/api/run", {"fuel_index": 1, "model": self.h32, "compare": False, "n": 20, "mc_replicas": 0})
        self.assertEqual(c, 200, d); r = d["result"]
        self.assertEqual(r["model"], "Spider H32X"); self.assertEqual(r["n_drones"], 20)
        self.assertLess(r["burned_ha"], r["burned_ha_without_drones"])
        for k in ("costs", "resolution", "tactics_table", "mesh_robustness", "sectors", "timeseries_ha", "routes_peak_round"):
            self.assertIn(k, r)
        self.assertGreater(r["costs"]["total_per_operation"], 0)

    def test_job_lifecycle_and_monte_carlo(self):
        c, j = http("POST", self.base + "/api/jobs", {"fuel_index": 0, "model": self.h32, "compare": False, "n": 8, "mc_replicas": 8, "threads": 2})
        self.assertEqual(c, 202)
        t0 = time.time()
        while time.time() - t0 < 300:
            _, s = http("GET", f"{self.base}/api/jobs/{j['id']}")
            if s["status"] in ("done", "error"): break
            time.sleep(1)
        self.assertEqual(s["status"], "done", s); mc = s["result"]["monte_carlo"]
        self.assertEqual(mc["replicas"], 8); self.assertTrue(0 <= mc["p_containment"] <= 1); self.assertIn("p50", mc["burned_ha"])

    def test_invalid_input(self):
        c, d = http("POST", self.base + "/api/run", {"fuel_index": 1, "overrides": {"nao_existe": 1}})
        self.assertEqual(c, 400); self.assertIn("nao_existe", json.dumps(d))
        self.assertEqual(http("GET", self.base + "/api/jobs/xxxx")[0], 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
