import json
import re
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

with open('index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

mapping = {}

# Match data-i18n="key">Text<
pattern_i18n = re.compile(r'data-i18n=[\"\']([\w\-]+)[\"\'][^>]*>([^<]*)<', re.IGNORECASE)
for k, text in pattern_i18n.findall(html_content):
    if k not in mapping or not mapping[k]:
        mapping[k] = text.strip()

# Match data-i18n-placeholder="key" placeholder="Text"
pattern_ph = re.compile(r'data-i18n-placeholder=[\"\']([\w\-]+)[\"\'][^>]*placeholder=[\"\']([^\"\']*)[\"\']', re.IGNORECASE)
for k, text in pattern_ph.findall(html_content):
    mapping[k] = text.strip()

with open('config/anne/translations.json', 'r', encoding='utf-8') as f:
    trans_data = json.load(f)

existing_dict = trans_data.get('translations', {})
all_keys_in_html = set(re.findall(r'data-i18n=[\"\']([\w\-]+)[\"\']', html_content)) | set(re.findall(r'data-i18n-placeholder=[\"\']([\w\-]+)[\"\']', html_content))
missing_keys = all_keys_in_html - set(existing_dict.keys())

print(f"Total missing: {len(missing_keys)}")
for k in sorted(list(missing_keys)):
    print(f"Key: {k:30} | VI: {mapping.get(k, 'N/A')}")
