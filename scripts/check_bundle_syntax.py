import os
import re
from collections import defaultdict

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS_DIR = os.path.join(ROOT_DIR, "js")

with open(os.path.join(ROOT_DIR, "scripts", "build_bundle.py"), "r", encoding="utf-8") as f:
    text = f.read()

m = re.search(r"MODULE_ORDER\s*=\s*\[(.*?)\]", text, re.DOTALL)
order_code = m.group(1)
modules = [s.strip().strip('"\'') for s in order_code.split(",") if s.strip().strip('"\'')]

top_declarations = defaultdict(list)

for mod in modules:
    path = os.path.join(JS_DIR, mod)
    if not os.path.exists(path):
        continue
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for i, line in enumerate(lines, 1):
        m_dec = re.match(r"^(?:export\s+)?(const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)", line)
        if m_dec:
            kind = m_dec.group(1)
            name = m_dec.group(2)
            top_declarations[name].append((mod, i, kind, line.strip()[:70]))

print("=== DUPLICATE TOP-LEVEL CONST / LET ===")
found = False
for name, occ in top_declarations.items():
    if len(occ) > 1:
        found = True
        print(f"\n[DUPLICATE] {name}:")
        for mod, line, kind, snip in occ:
            print(f"   {mod}:{line} [{kind}] -> {snip}")

if not found:
    print("No duplicate top-level const/let found!")
