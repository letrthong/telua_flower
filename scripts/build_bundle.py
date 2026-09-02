import os
import re

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
JS_DIR = os.path.join(ROOT_DIR, "js")

MODULE_ORDER = [
    "utils.js",
    "i18n.js",
    "products.js",
    "checkout.js",
    "auth.js",
    "customer_portal.js",
    "staff_portal.js",
    "order_dashboard.js",
    "portal_admin.js",
    "flower_app.js"
]

def clean_module_code(filename, code):
    # Remove local imports e.g. import ... from './...js';
    cleaned = re.sub(r'import\s+.*?from\s+[\'"]\.\/.*?\.js[\'"];?\n?', '', code)
    
    # Remove export default or export { ... }
    cleaned = re.sub(r'export\s*\{\s*[^}]*\};?\n?', '', cleaned)
    
    # Convert 'export const/let/var/function/async function/class' to just 'const/let/var/function/async function/class'
    cleaned = re.sub(r'export\s+(const|let|var|function|async\s+function|class)\b', r'\1', cleaned)
    
    return f"\n// ==========================================================================\n// MODULE: {filename}\n// ==========================================================================\n" + cleaned.strip() + "\n"

def build_bundle():
    bundle_parts = [
        "/**\n * TELUA FLOWER CONNECT - CONSOLIDATED BUNDLE JS\n * Bundled from modular components for high performance and single network request.\n */\n(function() {\n'use strict';\n"
    ]
    
    for mod_name in MODULE_ORDER:
        file_path = os.path.join(JS_DIR, mod_name)
        if not os.path.exists(file_path):
            print(f"Warning: {file_path} not found!")
            continue
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        bundle_parts.append(clean_module_code(mod_name, content))
        
    bundle_parts.append("\n})();\n")
    
    bundle_content = "\n".join(bundle_parts)
    output_path = os.path.join(JS_DIR, "bundle.js")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(bundle_content)
    
    print(f"Bundle successfully created at: {output_path} ({len(bundle_content)} bytes)")

if __name__ == "__main__":
    build_bundle()
