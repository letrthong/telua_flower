import test from 'node:test';
import assert from 'node:assert';
import { translations, langLabels, langShortCodes } from '../translations.js';

test('i18n - supported languages exist', (t) => {
    const langs = Object.keys(translations);
    const requiredLangs = ['vi', 'en', 'ja', 'ko', 'zh'];
    
    for (const lang of requiredLangs) {
        assert.ok(langs.includes(lang), `Thiếu ngôn ngữ '${lang}' trong translations`);
        assert.ok(langLabels[lang], `Thiếu nhãn tên cho ngôn ngữ '${lang}'`);
        assert.ok(langShortCodes[lang], `Thiếu mã viết tắt cho ngôn ngữ '${lang}'`);
    }
});

test('i18n - dictionary keys alignment across all languages', (t) => {
    const viKeys = Object.keys(translations.vi).sort();
    
    // Mỗi ngôn ngữ (en, ja, ko, zh) phải có đầy đủ các key như tiếng Việt (vi)
    for (const lang of ['en', 'ja', 'ko', 'zh']) {
        const langKeys = Object.keys(translations[lang]).sort();
        assert.deepStrictEqual(langKeys, viKeys, `Danh sách key của '${lang}' không khớp hoàn toàn với 'vi'`);
    }
});

test('i18n - non-empty translation values', (t) => {
    for (const [lang, dict] of Object.entries(translations)) {
        for (const [key, val] of Object.entries(dict)) {
            assert.ok(val && typeof val === 'string' && val.trim().length > 0, `Giá trị key '${key}' trong ngôn ngữ '${lang}' bị rỗng`);
        }
    }
});

test('company info - dynamic hotline and email synchronization from infoCompany.json', (t) => {
    const mockCompanyInfo = {
        hotline: "0976.999.888",
        phone: "0976.999.888",
        email: "contact@nohoathabinh.vn"
    };

    // Giả lập logic đồng bộ hotline vào từ điển
    const testTrans = JSON.parse(JSON.stringify(translations));
    Object.keys(testTrans).forEach(l => {
        if (testTrans[l] && testTrans[l].top_hotline) {
            testTrans[l].top_hotline = testTrans[l].top_hotline.replace(/[\d\.\-\s]{8,}/, mockCompanyInfo.hotline);
        }
    });

    assert.ok(testTrans.vi.top_hotline.includes("0976.999.888"), "Hotline tiếng Việt phải chứa số điện thoại động");
    assert.ok(testTrans.en.top_hotline.includes("0976.999.888"), "Hotline tiếng Anh phải chứa số điện thoại động");
    assert.ok(testTrans.ja.top_hotline.includes("0976.999.888"), "Hotline tiếng Nhật phải chứa số điện thoại động");
    assert.ok(testTrans.ko.top_hotline.includes("0976.999.888"), "Hotline tiếng Hàn phải chứa số điện thoại động");
    assert.ok(testTrans.zh.top_hotline.includes("0976.999.888"), "Hotline tiếng Trung phải chứa số điện thoại động");
});
