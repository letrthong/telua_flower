// Dữ liệu mock sản phẩm (Nở Hoa Thả Bình)
export const products_bo_hoa = [
    {
        name: "Mây Trắng Bồng Bềnh",
        originalPrice: "450,000₫",
        salePrice: "420,000₫",
        image: "https://images.unsplash.com/photo-1562690868-60bbe7293e94?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        badge: "-7%"
    },
    {
        name: "Ohara White And Pink Viency",
        originalPrice: "950,000₫",
        salePrice: "880,000₫",
        image: "https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        badge: "Hot"
    },
    {
        name: "Tulip Mix Lam Tinh",
        originalPrice: "1,980,000₫",
        salePrice: "1,980,000₫",
        image: "https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/tulip_and_Blue_Star_flower_mix.webp",
        badge: ""
    },
    {
        name: "Lily Julibee Ngọt Ngào",
        originalPrice: "950,000₫",
        salePrice: "850,000₫",
        image: "https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/lily_julibee.png",
        badge: "Mới"
    }
];

export const products_ke_hoa = [
    {
        name: "Kệ Hoa Khai Trương Phát Lộc",
        originalPrice: "2,650,000₫",
        salePrice: "2,500,000₫",
        image: "https://images.unsplash.com/photo-1561181286-d3fee7d55364?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        badge: ""
    },
    {
        name: "Kệ Hoa Chúc Mừng Ember Corgart",
        originalPrice: "1,800,000₫",
        salePrice: "1,800,000₫",
        image: "https://images.unsplash.com/photo-1507290439931-a861b5a38200?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        badge: "Hot"
    },
    {
        name: "Kệ Hoa Niên Niên Đại Phát",
        originalPrice: "1,700,000₫",
        salePrice: "1,700,000₫",
        image: "https://images.unsplash.com/photo-1591886960571-74d43a9d4166?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        badge: ""
    },
    {
        name: "Kệ Hoa Phát Tài Phát Đạt",
        originalPrice: "1,600,000₫",
        salePrice: "1,500,000₫",
        image: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        badge: ""
    }
];

export const products_binh_hoa = [
    {
        name: "Bình Thủy Tinh Hổ Phách Cao Cấp",
        originalPrice: "550,000₫",
        salePrice: "480,000₫",
        image: "https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/binh_ho_phach.png",
        badge: "Hot"
    },
    {
        name: "Bình Gốm Sứ Bắc Âu Phong Cách Vintage",
        originalPrice: "680,000₫",
        salePrice: "620,000₫",
        image: "https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/binh_g%E1%BB%91m_s%E1%BB%A9.jpg",
        badge: "Mới"
    },
    {
        name: "Bình Thủy Tinh Trong Suốt Dáng Trụ",
        originalPrice: "390,000₫",
        salePrice: "350,000₫",
        image: "https://raw.githubusercontent.com/letrthong/telua_public_image/main/anne/images/B%C3%ACnh%20Th%E1%BB%A7y%20Tinh%20Trong%20Su%E1%BB%91t%20D%C3%A1ng%20Tr%E1%BB%A5.webp",
        badge: ""
    },
    {
        name: "Bình Gốm Cắm Hoa Nghệ Thuật Minimalist",
        originalPrice: "750,000₫",
        salePrice: "690,000₫",
        image: "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80",
        badge: "Bán chạy"
    }
];

// Browser global support
if (typeof window !== 'undefined') {
    window.products_bo_hoa = products_bo_hoa;
    window.products_ke_hoa = products_ke_hoa;
    window.products_binh_hoa = products_binh_hoa;
}
