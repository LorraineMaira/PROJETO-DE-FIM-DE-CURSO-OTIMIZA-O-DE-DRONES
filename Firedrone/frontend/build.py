#!/usr/bin/env python3
"""Gera frontend/index.html: shell + núcleo (../core: data+engine+opt; o mesmo código roda nos Web Workers) + auxiliares + ui_ext + ui.
Uso (a partir de qualquer pasta): python frontend/build.py"""
from pathlib import Path
H = Path(__file__).resolve().parent; C = H.parent / "core"
rd = lambda p: p.read_text(encoding="utf-8")
core = "\n".join(rd(C / f) for f in ("data.js", "engine.js", "opt.js"))
helpers = "const $=id=>document.getElementById(id);\nconst f=(x,d=0)=>(+x).toLocaleString('pt-BR',{maximumFractionDigits:d});\n"
ui = helpers + rd(H / "src/ui_ext.js") + "\n" + rd(H / "src/ui.js")
assert "</script" not in core.lower() and "</script" not in ui.lower()
html = rd(H / "src/shell.html").rstrip() + '\n<script id="core">\n' + core + '\n</script>\n<script>\n' + ui + '\n</script></body></html>\n'
(H / "index.html").write_text(html, encoding="utf-8"); print("index.html:", len(html), "bytes")
