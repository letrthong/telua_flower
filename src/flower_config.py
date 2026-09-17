import os
import sys
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Optional, Dict, Any

# Cấu hình logger
logger = logging.getLogger("flower_config")

# Root directory of the workspace (tương thích cross-platform: Windows & Linux /app Docker)
ROOT_DIR = Path(__file__).resolve().parent.parent

# Source directory
SRC_DIR = ROOT_DIR / 'src'

_TEST_CONFIG_INITIALIZED = False


def _find_workspace_config_dir() -> Path:
    """Tìm thư mục cấu hình gốc config/anne trong workspace dự án."""
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "config" / "anne"
        if candidate.exists():
            return candidate

    if os.name != 'nt' and os.path.exists("/app/config/anne"):
        return Path("/app/config/anne")

    return ROOT_DIR / "config" / "anne"


def _is_test_environment() -> bool:
    """Phát hiện xem tiến trình có đang chạy Unit Test / Pytest hay không."""
    if os.environ.get("FLOWER_TEST_MODE") in ("1", "true", "True"):
        return True
    if "unittest" in sys.modules or "pytest" in sys.modules:
        return True
    if any("unittest" in arg or "pytest" in arg or ("test_" in os.path.basename(arg)) for arg in sys.argv):
        return True
    return False


def _sync_test_config(source_dir: Path, target_dir: Path):
    """
    Đồng bộ dữ liệu mẫu sạch từ source_dir sang target_dir (/tmp/config/anne).
    Đảm bảo môi trường kiểm thử có đầy đủ dữ liệu cấu hình ban đầu,
    nhưng không ghi đè hay sinh file rác vào config/anne của workspace.
    """
    global _TEST_CONFIG_INITIALIZED
    if _TEST_CONFIG_INITIALIZED:
        return

    if not source_dir.exists():
        return

    try:
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        target_dir.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source_dir, target_dir, dirs_exist_ok=True)
        _TEST_CONFIG_INITIALIZED = True
        logger.info(f"[FLOWER CONFIG] Đã đồng bộ dữ liệu test sạch từ {source_dir} sang {target_dir}")
    except Exception as e:
        logger.warning(f"[FLOWER CONFIG] Cảnh báo đồng bộ test config sang {target_dir}: {e}")


# Config directory (tự động nhận diện và cô lập riêng thư mục config/anne)
def _detect_config_dir() -> str:
    workspace_config = _find_workspace_config_dir()
    env_dir = os.environ.get("FLOWER_CONFIG_DIR")

    # 1. Nếu có chỉ định rõ qua biến môi trường FLOWER_CONFIG_DIR
    if env_dir:
        target_path = Path(os.path.abspath(env_dir))
        target_path.mkdir(parents=True, exist_ok=True)
        if target_path.resolve() != workspace_config.resolve():
            _sync_test_config(workspace_config, target_path)
        return str(target_path)

    # 2. Nếu đang chạy Unit Test: Tự động chuyển hướng sang thư mục tạm chuẩn của hệ điều hành
    #    - Windows: %TEMP%\telua_flower\config\anne (ví dụ: C:\Users\<user>\AppData\Local\Temp\telua_flower\config\anne)
    #    - Linux / Docker: /tmp/telua_flower/config/anne
    if _is_test_environment():
        test_dir = Path(tempfile.gettempdir()) / "telua_flower" / "config" / "anne"
        _sync_test_config(workspace_config, test_dir)
        return str(test_dir)

    # 3. Môi trường phát triển / sản xuất thông thường
    if workspace_config.exists():
        return str(workspace_config)

    # 4. Fallback thư mục config ngay tại root
    fallback = ROOT_DIR / "config" / "anne"
    fallback.mkdir(parents=True, exist_ok=True)
    return str(fallback)



# API URL Prefixes chuẩn hóa
API_V1_PREFIX = "/api/flower/v1"
FLOWER_IMAGE_URL_PREFIX = f"{API_V1_PREFIX}/images"

# Biến cấu hình module-level (được khởi tạo và cập nhật qua init_config)
FLOWER_CONFIG_DIR = None
FLOWER_ORDERS_DIR = None
PRODUCTS_DIR = None
USERS_DIR = None
IMAGES_DIR = None
PRODUCTS_IMAGES_DIR = None
PRODUCT_IMAGES_DIR = None
WASTAGE_IMAGES_DIR = None

USERS_FILE_PATH = None
STAFF_USERS_FILE_PATH = None
CUSTOMERS_FILE_PATH = None
BRANCHES_FILE_PATH = None
PRODUCTS_FILE_PATH = None
CATEGORIES_FILE_PATH = None
PRICE_LEVELS_FILE_PATH = None
PROMOTIONS_FILE_PATH = None
TRANSLATIONS_FILE_PATH = None
WASTAGE_REPORTS_FILE_PATH = None
PURCHASE_REQUESTS_FILE_PATH = None
COMPANY_INFO_FILE_PATH = None
BANNERS_FILE_PATH = None
CACHE_VERSION_FILE = None


def init_config(custom_config_dir: Optional[str] = None, verbose: bool = False) -> Dict[str, Any]:
    """
    Khởi tạo tường minh cấu hình hệ thống, thiết lập toàn bộ thư mục lưu trữ và đường dẫn file dữ liệu.
    Được gọi tường minh từ src/app.py khi khởi động ứng dụng Flask hoặc từ các scripts/kiểm thử.
    """
    global FLOWER_CONFIG_DIR, FLOWER_ORDERS_DIR, PRODUCTS_DIR, USERS_DIR, IMAGES_DIR
    global PRODUCTS_IMAGES_DIR, PRODUCT_IMAGES_DIR, WASTAGE_IMAGES_DIR
    global USERS_FILE_PATH, STAFF_USERS_FILE_PATH, CUSTOMERS_FILE_PATH, BRANCHES_FILE_PATH
    global PRODUCTS_FILE_PATH, CATEGORIES_FILE_PATH, PRICE_LEVELS_FILE_PATH, PROMOTIONS_FILE_PATH
    global TRANSLATIONS_FILE_PATH, WASTAGE_REPORTS_FILE_PATH, PURCHASE_REQUESTS_FILE_PATH
    global COMPANY_INFO_FILE_PATH, BANNERS_FILE_PATH, CACHE_VERSION_FILE

    if custom_config_dir:
        target_path = Path(os.path.abspath(custom_config_dir))
        target_path.mkdir(parents=True, exist_ok=True)
        workspace_config = _find_workspace_config_dir()
        if target_path.resolve() != workspace_config.resolve():
            _sync_test_config(workspace_config, target_path)
        FLOWER_CONFIG_DIR = str(target_path)
    else:
        FLOWER_CONFIG_DIR = _detect_config_dir()

    # Sub-directories
    FLOWER_ORDERS_DIR = os.path.join(FLOWER_CONFIG_DIR, "orders")
    PRODUCTS_DIR = os.path.join(FLOWER_CONFIG_DIR, "products")
    USERS_DIR = os.path.join(FLOWER_CONFIG_DIR, "users")
    IMAGES_DIR = os.path.join(FLOWER_CONFIG_DIR, "images")
    PRODUCTS_IMAGES_DIR = os.path.join(FLOWER_CONFIG_DIR, "products", "images")
    PRODUCT_IMAGES_DIR = IMAGES_DIR
    WASTAGE_IMAGES_DIR = os.path.join(FLOWER_CONFIG_DIR, "wastage", "images")

    # Tạo các thư mục lưu trữ cần thiết
    for d in [FLOWER_ORDERS_DIR, PRODUCTS_DIR, USERS_DIR, IMAGES_DIR, PRODUCTS_IMAGES_DIR, WASTAGE_IMAGES_DIR]:
        os.makedirs(d, exist_ok=True)

    # File paths chuẩn hóa
    STAFF_USERS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "staff_users.json")
    USERS_FILE_PATH = STAFF_USERS_FILE_PATH if os.path.exists(STAFF_USERS_FILE_PATH) else os.path.join(FLOWER_CONFIG_DIR, "users.json")
    CUSTOMERS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "customers.json")
    BRANCHES_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "branches.json")
    PRODUCTS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "products.json")
    CATEGORIES_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "categories.json")
    PRICE_LEVELS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "price_levels.json")
    PROMOTIONS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "promotions.json")
    TRANSLATIONS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "translations.json")
    WASTAGE_REPORTS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "wastage_reports.json")
    PURCHASE_REQUESTS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "purchase_requests.json")
    COMPANY_INFO_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "infoCompany.json")
    BANNERS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "banners.json")
    CACHE_VERSION_FILE = os.path.join(FLOWER_CONFIG_DIR, "cache_version.json")

    if verbose:
        print(f"[FLOWER CONFIG] ROOT_DIR: {ROOT_DIR}", flush=True)
        print(f"[FLOWER CONFIG] FLOWER_CONFIG_DIR: {FLOWER_CONFIG_DIR} (exists: {os.path.exists(FLOWER_CONFIG_DIR)})", flush=True)
        print(f"[FLOWER CONFIG] STAFF_USERS_FILE_PATH: {STAFF_USERS_FILE_PATH} (exists: {os.path.exists(STAFF_USERS_FILE_PATH)})", flush=True)
        print(f"[FLOWER CONFIG] CUSTOMERS_FILE_PATH: {CUSTOMERS_FILE_PATH} (exists: {os.path.exists(CUSTOMERS_FILE_PATH)})", flush=True)
        print(f"[FLOWER CONFIG] PRODUCTS_FILE_PATH: {PRODUCTS_FILE_PATH} (exists: {os.path.exists(PRODUCTS_FILE_PATH)})", flush=True)
        print(f"[FLOWER CONFIG] BRANCHES_FILE_PATH: {BRANCHES_FILE_PATH} (exists: {os.path.exists(BRANCHES_FILE_PATH)})", flush=True)

    logger.info(f"[FLOWER CONFIG] FLOWER_CONFIG_DIR: {FLOWER_CONFIG_DIR}")

    return {
        "FLOWER_CONFIG_DIR": FLOWER_CONFIG_DIR,
        "FLOWER_ORDERS_DIR": FLOWER_ORDERS_DIR,
        "PRODUCTS_DIR": PRODUCTS_DIR,
        "USERS_DIR": USERS_DIR,
        "IMAGES_DIR": IMAGES_DIR,
        "PRODUCTS_IMAGES_DIR": PRODUCTS_IMAGES_DIR,
        "PRODUCT_IMAGES_DIR": PRODUCT_IMAGES_DIR,
        "WASTAGE_IMAGES_DIR": WASTAGE_IMAGES_DIR,
        "STAFF_USERS_FILE_PATH": STAFF_USERS_FILE_PATH,
        "CUSTOMERS_FILE_PATH": CUSTOMERS_FILE_PATH,
        "BRANCHES_FILE_PATH": BRANCHES_FILE_PATH,
        "PRODUCTS_FILE_PATH": PRODUCTS_FILE_PATH,
        "CATEGORIES_FILE_PATH": CATEGORIES_FILE_PATH,
        "PRICE_LEVELS_FILE_PATH": PRICE_LEVELS_FILE_PATH,
        "PROMOTIONS_FILE_PATH": PROMOTIONS_FILE_PATH,
        "TRANSLATIONS_FILE_PATH": TRANSLATIONS_FILE_PATH,
        "WASTAGE_REPORTS_FILE_PATH": WASTAGE_REPORTS_FILE_PATH,
        "PURCHASE_REQUESTS_FILE_PATH": PURCHASE_REQUESTS_FILE_PATH,
        "COMPANY_INFO_FILE_PATH": COMPANY_INFO_FILE_PATH,
        "BANNERS_FILE_PATH": BANNERS_FILE_PATH,
    }


# Khởi tạo mặc định tự động để tương thích hoàn toàn các module import trực tiếp
init_config(verbose=False)


