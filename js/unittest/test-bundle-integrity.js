import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const bundlePath = path.join(rootDir, 'js', 'bundle.js');
const indexPath = path.join(rootDir, 'index.html');

test('bundle - file exists and is substantial (> 200KB)', () => {
    assert.ok(fs.existsSync(bundlePath), 'js/bundle.js must exist');
    const stats = fs.statSync(bundlePath);
    assert.ok(stats.size > 200000, `js/bundle.js size (${stats.size} bytes) should be > 200KB`);
});

test('bundle - does not contain unbundled ES module export/import statements', () => {
    const content = fs.readFileSync(bundlePath, 'utf8');

    // Unbundled exports cause SyntaxError in classic scripts
    const illegalExport = content.match(/^\s*export\s+(const|let|var|function|async|class|default|\{)/m);
    assert.strictEqual(illegalExport, null, `Found unstripped export statement: ${illegalExport ? illegalExport[0] : ''}`);

    // Unbundled imports cause SyntaxError in classic scripts
    const illegalImport = content.match(/^\s*import\s+[\s\S]*?from/m);
    assert.strictEqual(illegalImport, null, `Found unstripped import statement: ${illegalImport ? illegalImport[0] : ''}`);
});

test('html - index.html has base href and absolute bundle script path', () => {
    const html = fs.readFileSync(indexPath, 'utf8');

    assert.ok(html.includes('<base href="/">'), 'index.html must include <base href="/"> for SPA route support');
    const hasAbsoluteBundle = /<script\s+src="\/js\/bundle\.js(\?v=[^"]+)?"\s*>/i.test(html);
    assert.ok(hasAbsoluteBundle, 'index.html script tag must use absolute path "/js/bundle.js"');
});

test('bundle - binds all inline HTML event handler functions to window.*', () => {
    const html = fs.readFileSync(indexPath, 'utf8');
    const bundle = fs.readFileSync(bundlePath, 'utf8');

    // Find all inline handlers: onclick="foo(...)", oninput="bar(...)", etc.
    const handlerRegex = /\b(?:onclick|oninput|onchange|onsubmit|onkeydown|onkeyup)\s*=\s*"([^"]+)"/gi;
    const foundCalls = new Set();
    let match;

    while ((match = handlerRegex.exec(html)) !== null) {
        const handlerCode = match[1];
        // Match function invocations like funcName(...) or funcName('...')
        const callMatches = handlerCode.matchAll(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g);
        for (const callMatch of callMatches) {
            const funcName = callMatch[1];
            // Ignore standard JS keywords / builtins
            const builtins = new Set(['alert', 'confirm', 'prompt', 'console', 'log', 'event', 'Boolean', 'Number', 'String']);
            if (!builtins.has(funcName)) {
                foundCalls.add(funcName);
            }
        }
    }

    const missingInBundle = [];
    for (const funcName of foundCalls) {
        const windowPattern = `window.${funcName}`;
        if (!bundle.includes(windowPattern)) {
            missingInBundle.push(funcName);
        }
    }

    assert.strictEqual(
        missingInBundle.length,
        0,
        `Inline HTML event functions missing window.* binding in bundle.js: ${missingInBundle.join(', ')}`
    );
});
