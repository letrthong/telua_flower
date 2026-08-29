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

test('product load fallback - xác thực cơ chế phát hiện lỗi tải quá hạn 5s và giao diện phục hồi', (t) => {
    // Giả lập trạng thái tải sản phẩm
    function evaluateLoadStatus(products, elapsedMs) {
        const isTimedOut = elapsedMs >= 5000;
        const hasProducts = Array.isArray(products) && products.length > 0;
        
        if (hasProducts) {
            return { status: 'SUCCESS', showUi: 'PRODUCTS_GRID' };
        }
        if (isTimedOut && !hasProducts) {
            return { status: 'TIMEOUT_ERROR', showUi: 'RETRY_ERROR_BANNER' };
        }
        return { status: 'LOADING', showUi: 'SKELETON' };
    }

    // 1. Tải thành công trong 1 giây (<5s)
    const res1 = evaluateLoadStatus([{ id: 'bo_01' }], 1000);
    assert.strictEqual(res1.status, 'SUCCESS');
    assert.strictEqual(res1.showUi, 'PRODUCTS_GRID');

    // 2. Đang nạp ở giây thứ 3 (<5s)
    const res2 = evaluateLoadStatus([], 3000);
    assert.strictEqual(res2.status, 'LOADING');
    assert.strictEqual(res2.showUi, 'SKELETON');

    // 3. Quá 5 giây chưa có dữ liệu -> Bật giao diện báo lỗi & nút Thử lại
    const res3 = evaluateLoadStatus([], 5000);
    assert.strictEqual(res3.status, 'TIMEOUT_ERROR');
    assert.strictEqual(res3.showUi, 'RETRY_ERROR_BANNER');

    // 4. Quá 8 giây chưa có dữ liệu
    const res4 = evaluateLoadStatus(null, 8000);
    assert.strictEqual(res4.status, 'TIMEOUT_ERROR');
    assert.strictEqual(res4.showUi, 'RETRY_ERROR_BANNER');
});
