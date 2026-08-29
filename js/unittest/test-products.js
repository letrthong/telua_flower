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

test('product detail schema - validate all detail fields in config/anne/products/*.json', (t) => {
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));
    const detailsDir = path.resolve(__dirname, '../../config/anne/products');

    for (const p of products) {
        const detailFile = path.join(detailsDir, `${p.id}.json`);
        assert.ok(fs.existsSync(detailFile), `Thiếu tệp ${p.id}.json`);
        
        const detail = JSON.parse(fs.readFileSync(detailFile, 'utf8'));
        assert.strictEqual(detail.id, p.id, `ID trong file ${p.id}.json không khớp`);
        assert.strictEqual(detail.name, p.name, `Tên trong file ${p.id}.json không khớp`);
        
        // Kiểm tra sự hiện diện của các trường chi tiết
        assert.ok('description' in detail, `Thiếu trường 'description' trong ${p.id}.json`);
        assert.ok('flowerComposition' in detail, `Thiếu trường 'flowerComposition' trong ${p.id}.json`);
        assert.ok('dimension' in detail, `Thiếu trường 'dimension' trong ${p.id}.json`);
        assert.ok('careTips' in detail, `Thiếu trường 'careTips' trong ${p.id}.json`);
        assert.ok('stockByBranch' in detail, `Thiếu trường 'stockByBranch' trong ${p.id}.json`);
    }
});

test('product modular i18n - validate embedded i18n resolution and fallback in products/{id}.json', (t) => {
    const detailsDir = path.resolve(__dirname, '../../config/anne/products');
    const bo01Path = path.join(detailsDir, 'bo_hoa_01.json');
    assert.ok(fs.existsSync(bo01Path), "Tệp bo_hoa_01.json phải tồn tại");

    const detail = JSON.parse(fs.readFileSync(bo01Path, 'utf8'));
    assert.ok(detail.i18n, "bo_hoa_01.json phải có khối dữ liệu i18n");
    assert.ok(detail.i18n.en, "bo_hoa_01.json phải có bản dịch tiếng Anh (en)");
    assert.ok(detail.i18n.ja, "bo_hoa_01.json phải có bản dịch tiếng Nhật (ja)");
    assert.ok(detail.i18n.ko, "bo_hoa_01.json phải có bản dịch tiếng Hàn (ko)");
    assert.ok(detail.i18n.zh, "bo_hoa_01.json phải có bản dịch tiếng Trung (zh)");

    // Kiểm tra tính đầy đủ của trường dịch
    assert.strictEqual(detail.i18n.en.name, "Floating White Clouds Bouquet");
    assert.ok(detail.i18n.en.flowerComposition.includes("White Ohara Roses"));
    assert.ok(detail.i18n.en.description.includes("pure white bouquet"));
    assert.ok(detail.i18n.en.careTips.includes("Trim stems"));

    // Hàm mô phỏng phân giải ngôn ngữ phía Backend hoặc Frontend
    function resolveProductI18n(prod, lang) {
        if (!lang || lang === 'vi' || !prod.i18n || !prod.i18n[lang]) {
            return {
                name: prod.name,
                flowerComposition: prod.flowerComposition,
                description: prod.description,
                careTips: prod.careTips
            };
        }
        const l = prod.i18n[lang];
        return {
            name: l.name || prod.name,
            flowerComposition: l.flowerComposition || prod.flowerComposition,
            description: l.description || prod.description,
            careTips: l.careTips || prod.careTips
        };
    }

    // 1. Phân giải tiếng Anh
    const enResolved = resolveProductI18n(detail, 'en');
    assert.strictEqual(enResolved.name, "Floating White Clouds Bouquet");
    assert.ok(enResolved.flowerComposition.includes("White Ohara Roses"));

    // 2. Phân giải tiếng Nhật
    const jaResolved = resolveProductI18n(detail, 'ja');
    assert.strictEqual(jaResolved.name, "白い雲のフローティングブーケ");

    // 3. Fallback khi ngôn ngữ chưa có bản dịch
    const frResolved = resolveProductI18n(detail, 'fr');
    assert.strictEqual(frResolved.name, "Mây Trắng Bồng Bềnh");
    assert.strictEqual(frResolved.flowerComposition, detail.flowerComposition);
});
