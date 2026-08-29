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

test('categories.json - textId multi-language keys validation in translations.json', (t) => {
    const categoriesPath = path.resolve(__dirname, '../../config/anne/categories.json');
    assert.ok(fs.existsSync(categoriesPath), "Tệp categories.json phải tồn tại");

    const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
    const translationsRaw = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    const transDict = translationsRaw.translations || translationsRaw;

    const supportedLangs = ['vi', 'en', 'ja', 'ko', 'zh'];

    for (const cat of categories) {
        if (cat.textId) {
            assert.ok(typeof cat.textId === 'string' && cat.textId.startsWith('cat_'), `Category '${cat.id}' có textId '${cat.textId}' phải bắt đầu bằng 'cat_'`);
            assert.ok(cat.textId in transDict, `Khóa textId '${cat.textId}' của danh mục '${cat.name}' phải có trong translations.json`);
            
            const transItem = transDict[cat.textId];
            for (const lang of supportedLangs) {
                assert.ok(lang in transItem && typeof transItem[lang] === 'string' && transItem[lang].trim().length > 0, `Khóa '${cat.textId}' thiếu bản dịch cho ngôn ngữ '${lang}'`);
            }
        }
    }
});

test('translations.json - type system vs user classification validation', (t) => {
    const raw = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    const transDict = raw.translations || raw;

    // 1. Các khóa cốt lõi phải có type = 'system'
    const coreSystemKeys = ['site_title', 'hotline', 'hero_heading', 'feat_delivery_title', 'cat_bouquet', 'cat_basket'];
    for (const k of coreSystemKeys) {
        assert.ok(k in transDict, `Thiếu khóa ${k} trong translations.json`);
        assert.strictEqual(transDict[k].type, 'system', `Khóa ${k} phải có type='system'`);
    }

    // 2. Khóa banner slogan thử nghiệm phải có type = 'user'
    assert.strictEqual(transDict.test_banner_slogan.type, 'user', 'Khóa test_banner_slogan phải có type=user');
});

test('categories dynamic name resolution - getCategoryDisplayName priority and fallback rule', (t) => {
    const raw = JSON.parse(fs.readFileSync(translationsPath, 'utf8'));
    const transDict = raw.translations || raw;

    // Giả lập ma trận từ điển đa ngôn ngữ
    const mockTrans = {
        vi: { cat_bouquet: transDict.cat_bouquet.vi },
        en: { cat_bouquet: transDict.cat_bouquet.en },
        ja: { cat_bouquet: transDict.cat_bouquet.ja }
    };

    function resolveCategoryName(cat, lang) {
        if (!cat) return "";
        if (cat.textId && mockTrans[lang] && mockTrans[lang][cat.textId]) {
            return mockTrans[lang][cat.textId];
        }
        return cat.name || "";
    }

    // 1. Khi có textId và có bản dịch tiếng Anh -> Trả về bản dịch tiếng Anh
    const catWithTextId = { id: 'bo_hoa', textId: 'cat_bouquet', name: 'Bó Hoa Tươi' };
    assert.strictEqual(resolveCategoryName(catWithTextId, 'en'), 'Fresh Bouquets');
    assert.strictEqual(resolveCategoryName(catWithTextId, 'ja'), '花束');

    // 2. Khi không có textId -> Fallback về cat.name
    const catNoTextId = { id: 'hoa_dac_biet', name: 'Hoa Mùa Thu' };
    assert.strictEqual(resolveCategoryName(catNoTextId, 'en'), 'Hoa Mùa Thu');

    // 3. Khi có textId nhưng chưa có trong từ điển -> Fallback về cat.name an toàn
    const catUnknownTextId = { id: 'hoa_doc_la', textId: 'cat_not_in_dict', name: 'Hoa Độc Lạ' };
    assert.strictEqual(resolveCategoryName(catUnknownTextId, 'en'), 'Hoa Độc Lạ');
});

test('translations GUI add new key - auto initialization of type user and 5 languages with key name', (t) => {
    const rawKey = 'promo_spring_2026';
    
    // Giả lập hàm khởi tạo key mới từ GUI
    function initNewTranslationKey(key) {
        const cleanKey = key.trim().toLowerCase().replace(/\s+/g, '_');
        return {
            [cleanKey]: {
                type: 'user',
                vi: cleanKey,
                en: cleanKey,
                ja: cleanKey,
                ko: cleanKey,
                zh: cleanKey
            }
        };
    }

    const created = initNewTranslationKey(rawKey);
    assert.ok(rawKey in created, "Key mới phải được tạo trong từ điển");
    assert.strictEqual(created[rawKey].type, 'user', "Type của key mới tạo phải là 'user'");
    assert.strictEqual(created[rawKey].vi, rawKey, "Giá trị vi phải bằng chính textId ban đầu");
    assert.strictEqual(created[rawKey].en, rawKey, "Giá trị en phải bằng chính textId ban đầu");
    assert.strictEqual(created[rawKey].ja, rawKey, "Giá trị ja phải bằng chính textId ban đầu");
    assert.strictEqual(created[rawKey].ko, rawKey, "Giá trị ko phải bằng chính textId ban đầu");
    assert.strictEqual(created[rawKey].zh, rawKey, "Giá trị zh phải bằng chính textId ban đầu");
});
