#!/usr/bin/env python3
"""Paridade navegador × Node: o MESMO núcleo deve dar números idênticos no Chromium (frontend/index.html) e no executor do backend.
Uso: python test_parity.py      (precisa de playwright + Chromium; é opcional para quem só usa a interface)"""
import asyncio, json, subprocess, sys
from pathlib import Path
R = Path(__file__).resolve().parent.parent
CASES = [(0, "Spider H32X", 6), (1, "Spider H40X", 10), (6, "DJI FlyCart 30", 5), (12, "Spider H60-4", 40)]
JS = """(cases)=>cases.map(([fi,name,n])=>{const d=FUELS[fi].d,p={fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,wcost:5};
 p.cs=OPS.resolve({p}).cs;const m=MODELS.find(x=>x.name==name),r=OPS.eval({p,m,n,seed:1,tacs:['indireto','cercamento'],fast:1});return{cs:p.cs,ok:r.ok,burned:r.burned,tactic:r.tactic,litres:r.litres,tot:r.tot}})"""
NODE = """const {load}=require('%s/backend/core_loader');const A=load();const cases=%s;
console.log(JSON.stringify(cases.map(([fi,name,n])=>{const d=A.FUELS[fi].d,p={fi,area:d.area,a0:d.a0,wind:d.wind,wdir:d.wdir,slope:d.slope,sdir:d.sdir,rh:d.rh,temp:d.temp,bdist:Math.max(300,d.bdist),brel:d.brel,delay:d.resp,maxloss:d.maxloss,noise:1,tc:1800,lead:240,opsyr:100,life:5,fixop:500,wcost:5};
 p.cs=A.OPS.resolve({p}).cs;const m=A.MODELS.find(x=>x.name==name),r=A.OPS.eval({p,m,n,seed:1,tacs:['indireto','cercamento'],fast:1});return{cs:p.cs,ok:r.ok,burned:r.burned,tactic:r.tactic,litres:r.litres,tot:r.tot}})))"""
async def browser():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        b = await pw.chromium.launch(args=["--no-sandbox"]); pg = await b.new_page()
        await pg.goto("file://" + str(R / "frontend" / "index.html")); await pg.wait_for_function("typeof OPS!=='undefined'")
        out = await pg.evaluate(JS, [list(c) for c in CASES]); await b.close(); return out
def main():
    nodes = json.loads(subprocess.run(["node", "-e", NODE % (R, json.dumps(CASES))], capture_output=True, text=True, check=True).stdout)
    brow = asyncio.run(browser()); bad = 0
    for c, a, b in zip(CASES, nodes, brow):
        same = all((abs(a[k] - b[k]) <= 1e-9 * max(1, abs(a[k])) if isinstance(a[k], (int, float)) and not isinstance(a[k], bool) else a[k] == b[k]) for k in a)
        bad += not same; print(("IGUAL  " if same else "DIFERE ") + f"cenário {c[0]+1:>2} {c[1]:<16} n={c[2]:<3} node={a} navegador={b}" if not same else f"IGUAL   cenário {c[0]+1:>2} {c[1]:<16} n={c[2]:<3} área {a['burned']:.3f} ha · contido={a['ok']} · tática {a['tactic']} · custo {a['tot']:.1f}")
    print("\nParidade OK." if not bad else f"\n{bad} divergência(s)."); sys.exit(1 if bad else 0)
if __name__ == "__main__": main()
