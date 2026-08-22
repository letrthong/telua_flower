import test from 'node:test';
import assert from 'node:assert';

const PRICE_LEVEL_CONFIG = {
    price_lvl_01: { name: "LV_01: Phổ Thông (Standard)", min: 300000, max: 550000 },
    price_lvl_02: { name: "LV_02: Cao Cấp (Premium)", min: 600000, max: 950000 },
    price_lvl_03: { name: "LV_03: Sang Trọng (Luxury)", min: 1000000, max: 2500000 },
    price_lvl_04: { name: "LV_04: Độc Bản VIP (Exclusive)", min: 2600000, max: 15000000 }
};

function checkPriceGovernance(levelId, priceNumber) {
    const lvl = PRICE_LEVEL_CONFIG[levelId];
    if (!lvl) return { valid: false, reason: "INVALID_LEVEL" };
    if (priceNumber < lvl.min) return { valid: false, reason: "UNDERPRICING" };
    if (priceNumber > lvl.max) return { valid: false, reason: "OVERPRICING" };
    return { valid: true };
}

test('price governance - valid price passes check', (t) => {
    // LV_01 (300k - 550k) với giá 420.000₫
    const res1 = checkPriceGovernance('price_lvl_01', 420000);
    assert.strictEqual(res1.valid, true);

    // LV_04 (2.6M - 15M) với giá 3.500.000₫
    const res4 = checkPriceGovernance('price_lvl_04', 3500000);
    assert.strictEqual(res4.valid, true);
});

test('price governance - underpricing is rejected', (t) => {
    // LV_01 giá sàn 300k, nhập 100k -> Bị chặn
    const res = checkPriceGovernance('price_lvl_01', 100000);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "UNDERPRICING");
});

test('price governance - overpricing is rejected', (t) => {
    // LV_02 giá trần 950k, nhập 1.200.000₫ -> Bị chặn
    const res = checkPriceGovernance('price_lvl_02', 1200000);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, "OVERPRICING");
});
