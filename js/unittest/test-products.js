import test from 'node:test';
import assert from 'node:assert';
import { products_bo_hoa, products_ke_hoa, products_binh_hoa } from '../products.js';

test('products - categories are non-empty arrays', (t) => {
    assert.ok(Array.isArray(products_bo_hoa) && products_bo_hoa.length > 0, "products_bo_hoa phải là mảng không rỗng");
    assert.ok(Array.isArray(products_ke_hoa) && products_ke_hoa.length > 0, "products_ke_hoa phải là mảng không rỗng");
    assert.ok(Array.isArray(products_binh_hoa) && products_binh_hoa.length > 0, "products_binh_hoa phải là mảng không rỗng");
});

test('products - required fields validation', (t) => {
    const allProducts = [...products_bo_hoa, ...products_ke_hoa, ...products_binh_hoa];
    
    for (const p of allProducts) {
        assert.ok(p.name && typeof p.name === 'string', `Sản phẩm thiếu trường 'name': ${JSON.stringify(p)}`);
        assert.ok(p.originalPrice && typeof p.originalPrice === 'string', `Sản phẩm '${p.name}' thiếu 'originalPrice'`);
        assert.ok(p.salePrice && typeof p.salePrice === 'string', `Sản phẩm '${p.name}' thiếu 'salePrice'`);
        assert.ok(p.image && typeof p.image === 'string', `Sản phẩm '${p.name}' thiếu 'image'`);
    }
});

test('products - prices format validation', (t) => {
    const allProducts = [...products_bo_hoa, ...products_ke_hoa, ...products_binh_hoa];
    
    for (const p of allProducts) {
        // Giá phải có đơn vị tiền tệ ₫
        assert.ok(p.salePrice.includes('₫'), `Giá bán '${p.salePrice}' của '${p.name}' phải chứa ký hiệu ₫`);
        assert.ok(p.originalPrice.includes('₫'), `Giá gốc '${p.originalPrice}' của '${p.name}' phải chứa ký hiệu ₫`);
    }
});
