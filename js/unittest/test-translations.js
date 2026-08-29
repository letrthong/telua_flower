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

test('company info vs i18n - separation of concerns for hotline and infoCompany', (t) => {
    // 1. Từ điển dịch chỉ chứa nhãn text hiển thị, không chứa số điện thoại cố định
    assert.strictEqual(translations.vi.hotline, "Hotline:");
    assert.strictEqual(translations.en.hotline, "Hotline:");
    assert.strictEqual(translations.ja.hotline, "ホットライン:");
    assert.strictEqual(translations.ko.hotline, "고객센터:");
    assert.strictEqual(translations.zh.hotline, "服务热线:");

    // 2. Không được chứa số điện thoại trong từ điển
    ['vi', 'en', 'ja', 'ko', 'zh'].forEach(l => {
        assert.ok(!/\d{4}/.test(translations[l].hotline), `Từ điển ngôn ngữ '${l}' của hotline không được chứa số điện thoại hardcode`);
    });
});

test('translations.json - quote escaping and JSON syntax validation', (t) => {
    const raw = fs.readFileSync(translationsPath, 'utf8');
    
    // 1. Phải parse thành công không có lỗi cú pháp
    let parsed;
    assert.doesNotThrow(() => {
        parsed = JSON.parse(raw);
    }, "translations.json phải là tệp JSON hoàn toàn hợp lệ");

    // 2. Kiểm tra chuỗi chứa ngoặc kép hoặc ký tự đặc biệt được serialize & parse đúng
    const testMap = {
        vi: { test_quote: 'Bó hoa "Tình Yêu" đặc biệt' },
        en: { test_quote: 'Special "Love" bouquet' }
    };
    const serialized = JSON.stringify(testMap, null, 2);
    assert.ok(serialized.includes('\\"Tình Yêu\\"'), "Dấu ngoặc kép phải được escape thành \\\"");
    const reParsed = JSON.parse(serialized);
    assert.strictEqual(reParsed.vi.test_quote, 'Bó hoa "Tình Yêu" đặc biệt');
});
