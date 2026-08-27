import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsPath = path.resolve(__dirname, '../../config/anne/products.json');
const categoriesPath = path.resolve(__dirname, '../../config/anne/categories.json');

test('products.json - valid JSON and non-empty array', (t) => {
    assert.ok(fs.existsSync(productsPath), "Tệp products.json phải tồn tại");
    const raw = fs.readFileSync(productsPath, 'utf8');
    const products = JSON.parse(raw);
    assert.ok(Array.isArray(products) && products.length > 0, "products.json phải là mảng sản phẩm hợp lệ");
});

test('products.json - required fields validation', (t) => {
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    
    for (const p of products) {
        assert.ok(p.id && typeof p.id === 'string', `Sản phẩm thiếu 'id': ${JSON.stringify(p)}`);
        assert.ok(p.name && typeof p.name === 'string', `Sản phẩm '${p.id}' thiếu 'name'`);
        assert.ok(p.category && typeof p.category === 'string', `Sản phẩm '${p.name}' thiếu 'category'`);
        assert.ok(typeof p.priceNumber === 'number' && p.priceNumber > 0, `Sản phẩm '${p.name}' priceNumber phải là số > 0`);
        assert.ok(p.salePrice && typeof p.salePrice === 'string', `Sản phẩm '${p.name}' thiếu 'salePrice'`);
        assert.ok(p.image && typeof p.image === 'string', `Sản phẩm '${p.name}' thiếu 'image'`);
    }
});

test('products.json - details files exist in config/anne/products/', (t) => {
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    const detailsDir = path.resolve(__dirname, '../../config/anne/products');
    
    for (const p of products) {
        const detailFile = path.join(detailsDir, `${p.id}.json`);
        assert.ok(fs.existsSync(detailFile), `Thiếu tệp chi tiết ${p.id}.json trong config/anne/products/`);
    }
});
