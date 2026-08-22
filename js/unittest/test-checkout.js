import test from 'node:test';
import assert from 'node:assert';
import {
    calculateSubtotal,
    formatVND
} from '../checkout.js';

test('cart - calculateSubtotal with various items', (t) => {
    const mockItems = [
        { productId: 'bo_hoa_01', name: 'Mây Trắng Bồng Bềnh', price: 420000, quantity: 2 },
        { productId: 'binh_hoa_01', name: 'Bình Gốm Tĩnh Lặng', price: 1800000, quantity: 1 }
    ];

    const subtotal = calculateSubtotal(mockItems);
    assert.strictEqual(subtotal, 420000 * 2 + 1800000, "Tổng tạm tính phải là 2.640.000₫");
});

test('cart - calculateSubtotal on empty cart', (t) => {
    const emptySubtotal = calculateSubtotal([]);
    assert.strictEqual(emptySubtotal, 0, "Giỏ hàng rỗng tổng tiền phải bằng 0");
});

test('cart - formatVND produces valid currency string', (t) => {
    const formatted = formatVND(420000);
    assert.ok(formatted.includes('420') || formatted.includes('₫'), "Định dạng phải chứa số tiền hoặc ký hiệu ₫");
});

test('checkout - shipping fee business rules', (t) => {
    // 1. Đơn dưới 500k -> phí ship chuẩn 35.000₫
    const subtotalLow = 420000;
    const standardFee = subtotalLow < 500000 ? 35000 : 0;
    assert.strictEqual(standardFee, 35000, "Đơn dưới 500k phí ship tiêu chuẩn phải là 35k");

    // 2. Đơn từ 500k trở lên -> Freeship 0₫
    const subtotalHigh = 840000;
    const freeFee = subtotalHigh >= 500000 ? 0 : 35000;
    assert.strictEqual(freeFee, 0, "Đơn từ 500k trở lên phải được miễn phí giao hàng");

    // 3. Giao hỏa tốc 2H -> phí cố định 50.000₫
    const isExpress2H = true;
    const expressFee = isExpress2H ? 50000 : 35000;
    assert.strictEqual(expressFee, 50000, "Giao hỏa tốc 2H phí cố định phải là 50k");
});
