import test from 'node:test';
import assert from 'node:assert';
import { removeVietnameseTones } from '../utils.js';

// Mock danh sách sản phẩm mẫu để kiểm thử logic tìm kiếm & bộ lọc
const MOCK_PRODUCTS = [
    {
        id: "bo_hoa_01",
        name: "Bó Hoa Hồng Đỏ Ecuador Tình Yêu",
        category: "bo_hoa",
        priceNumber: 650000,
        flowerComposition: "Hoa hồng đỏ Ecuador, hoa baby trắng, lá bạc",
        description: "Bó hoa hồng sang trọng quyến rũ tặng người yêu",
        isActive: true
    },
    {
        id: "lan_01",
        name: "Chậu Lan Hồ Điệp Phú Quý Hoàng Kim",
        category: "lan_ho_diep",
        priceNumber: 2500000,
        flowerComposition: "5 cành Lan hồ điệp vàng hoàng kim, chậu gốm Bát Tràng",
        description: "Món quà phong thủy mang tài lộc khai trương",
        isActive: true
    },
    {
        id: "ke_hoa_01",
        name: "Kệ Hoa Khai Trương Đại Hồng Phát",
        category: "ke_hoa",
        priceNumber: 1500000,
        flowerComposition: "Hoa đồng tiền, hoa hướng dương, hoa môn đỏ",
        description: "Kệ hoa mừng khai trương hồng phát rực rỡ",
        isActive: true
    },
    {
        id: "bo_hoa_hidden",
        name: "Bó Hoa Tulip Hà Lan Mùa Xuân (Tạm Ẩn)",
        category: "bo_hoa",
        priceNumber: 800000,
        flowerComposition: "Hoa tulip nhập khẩu Hà Lan",
        description: "Mẫu hoa đã hết mùa, tạm ẩn khỏi website",
        isActive: false
    }
];

// ==========================================
// 1. KIỂM THỬ HÀM CHUẨN HÓA TIẾNG VIỆT
// ==========================================

test('removeVietnameseTones - chuẩn hóa nguyên âm và dấu thanh tiếng Việt', (t) => {
    assert.strictEqual(removeVietnameseTones('Hồng'), 'hong');
    assert.strictEqual(removeVietnameseTones('Hoa Hồng Đỏ'), 'hoa hong do');
    assert.strictEqual(removeVietnameseTones('Lan Hồ Điệp'), 'lan ho diep');
    assert.strictEqual(removeVietnameseTones('Kệ Khai Trương Phát Tài'), 'ke khai truong phat tai');
    assert.strictEqual(removeVietnameseTones('Đồng Tiền & Hướng Dương'), 'dong tien & huong duong');
});

test('removeVietnameseTones - xử lý chuỗi rỗng và chuỗi đặc biệt an toàn', (t) => {
    assert.strictEqual(removeVietnameseTones(''), '');
    assert.strictEqual(removeVietnameseTones(null), '');
    assert.strictEqual(removeVietnameseTones(undefined), '');
    assert.strictEqual(removeVietnameseTones('   Tulip   '), 'tulip');
    assert.strictEqual(removeVietnameseTones('12345'), '12345');
});

// ==========================================
// 2. KIỂM THỬ TÌM KIẾM SẢN PHẨM KHÔNG DẤU & CÓ DẤU
// ==========================================

function filterProductsBySearch(products, query) {
    if (!query || !query.trim()) return products;
    const rawQuery = query.trim();
    const q = rawQuery.toLowerCase();
    const normQ = removeVietnameseTones(rawQuery);

    return products.filter(p => {
        if (!p) return false;
        const name = (p.name || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const comp = (p.flowerComposition || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();

        const normName = removeVietnameseTones(name);
        const normComp = removeVietnameseTones(comp);
        const normDesc = removeVietnameseTones(desc);

        return normName.includes(normQ) || id.includes(q) || normComp.includes(normQ) || normDesc.includes(normQ);
    });
}

test('search - tìm kiếm theo tên có dấu và không dấu', (t) => {
    // 1. Tìm có dấu
    const resAccented = filterProductsBySearch(MOCK_PRODUCTS, "Hoa Hồng");
    assert.strictEqual(resAccented.length, 1);
    assert.strictEqual(resAccented[0].id, "bo_hoa_01");

    // 2. Tìm không dấu
    const resUnaccented = filterProductsBySearch(MOCK_PRODUCTS, "hoa hong");
    assert.strictEqual(resUnaccented.length, 1);
    assert.strictEqual(resUnaccented[0].id, "bo_hoa_01");

    // 3. Tìm không dấu Lan Hồ Điệp
    const resLan = filterProductsBySearch(MOCK_PRODUCTS, "lan ho diep");
    assert.strictEqual(resLan.length, 1);
    assert.strictEqual(resLan[0].id, "lan_01");
});

test('search - tìm kiếm theo thành phần hoa (composition) không dấu', (t) => {
    const resComp = filterProductsBySearch(MOCK_PRODUCTS, "baby trang");
    assert.strictEqual(resComp.length, 1);
    assert.strictEqual(resComp[0].id, "bo_hoa_01");

    const resHuongDuong = filterProductsBySearch(MOCK_PRODUCTS, "huong duong");
    assert.strictEqual(resHuongDuong.length, 1);
    assert.strictEqual(resHuongDuong[0].id, "ke_hoa_01");
});

test('search - tìm kiếm theo ID sản phẩm', (t) => {
    const resId = filterProductsBySearch(MOCK_PRODUCTS, "lan_01");
    assert.strictEqual(resId.length, 1);
    assert.strictEqual(resId[0].name, "Chậu Lan Hồ Điệp Phú Quý Hoàng Kim");
});

test('search - tìm kiếm từ khóa không khớp trả về mảng rỗng', (t) => {
    const resNone = filterProductsBySearch(MOCK_PRODUCTS, "khong_ton_tai_xyz_123");
    assert.strictEqual(resNone.length, 0);
});

// ==========================================
// 3. KIỂM THỬ BỘ LỌC TRẠNG THÁI (ACTIVE / INACTIVE)
// ==========================================

test('filter - lọc theo trạng thái isActive (Đang bán vs Đã ẩn)', (t) => {
    // Chỉ lấy sản phẩm đang bán
    const activeProducts = MOCK_PRODUCTS.filter(p => p.isActive !== false);
    assert.strictEqual(activeProducts.length, 3);
    assert.ok(activeProducts.every(p => p.isActive === true));

    // Chỉ lấy sản phẩm đã ẩn
    const inactiveProducts = MOCK_PRODUCTS.filter(p => p.isActive === false);
    assert.strictEqual(inactiveProducts.length, 1);
    assert.strictEqual(inactiveProducts[0].id, "bo_hoa_hidden");
});

// ==========================================
// 4. KIỂM THỬ PARSE THAM SỐ HASH ROUTING / QUERY URL
// ==========================================

function parseQueryFromUrlString(urlString) {
    const parsedUrl = new URL(urlString, 'http://localhost');
    
    // 1. Kiểm tra từ Hash (/#search?q=... hoặc #/q=...)
    const hash = (parsedUrl.hash || '').replace(/^#\/?/, '');
    if (hash) {
        if (hash.includes('?') || hash.startsWith('q=')) {
            const queryPart = hash.includes('?') ? hash.split('?')[1] : hash;
            const params = new URLSearchParams(queryPart);
            if (params.get('q')) return params.get('q');
        }
    }

    // 2. Kiểm tra từ query param truyền thống
    if (parsedUrl.searchParams.get('q')) {
        return parsedUrl.searchParams.get('q');
    }

    return null;
}

test('url parser - trích xuất từ khóa tìm kiếm từ Hash routing chuẩn', (t) => {
    // 1. decode 'hồng' (%E1%BB%93)
    const q1 = parseQueryFromUrlString('http://localhost/#/search?q=h%E1%BB%93ng');
    assert.strictEqual(q1, 'hồng');

    // 2. decode 'lan ho diep'
    const q2 = parseQueryFromUrlString('http://localhost/#search?q=lan%20ho%20diep');
    assert.strictEqual(q2, 'lan ho diep');

    // 3. decode query string
    const q3 = parseQueryFromUrlString('http://localhost/search?q=tulip');
    assert.strictEqual(q3, 'tulip');

    // 4. hash rỗng
    const qEmpty = parseQueryFromUrlString('http://localhost/#');
    assert.strictEqual(qEmpty, null);
});

// ==========================================
// 5. KIỂM THỬ NÚT XÓA TÌM KIẾM (CLEAR BUTTON 'X')
// ==========================================

function shouldShowClearButton(query) {
    return Boolean(query && query.toString().trim().length > 0);
}

test('search clear button - xác định hiển thị nút X khi có text và ẩn khi chuỗi rỗng', (t) => {
    assert.strictEqual(shouldShowClearButton('Hoa hồng'), true);
    assert.strictEqual(shouldShowClearButton('a'), true);
    assert.strictEqual(shouldShowClearButton('   '), false);
    assert.strictEqual(shouldShowClearButton(''), false);
    assert.strictEqual(shouldShowClearButton(null), false);
    assert.strictEqual(shouldShowClearButton(undefined), false);
});
