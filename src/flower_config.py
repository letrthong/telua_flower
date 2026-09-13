import os
import sys
import logging
import shutil
from pathlib import Path

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

    # 2. Nếu đang chạy Unit Test: Tự động chuyển hướng sang /tmp/config/anne
    if _is_test_environment():
        test_dir = Path(os.path.abspath("/tmp/config/anne"))
        _sync_test_config(workspace_config, test_dir)
        return str(test_dir)

    # 3. Môi trường phát triển / sản xuất thông thường
    if workspace_config.exists():
        return str(workspace_config)

    # 4. Fallback thư mục config ngay tại root
    fallback = ROOT_DIR / "config" / "anne"
    fallback.mkdir(parents=True, exist_ok=True)
    return str(fallback)


FLOWER_CONFIG_DIR = _detect_config_dir()

# Sub-directories
FLOWER_ORDERS_DIR = os.path.join(FLOWER_CONFIG_DIR, "orders")
PRODUCTS_DIR = os.path.join(FLOWER_CONFIG_DIR, "products")
USERS_DIR = os.path.join(FLOWER_CONFIG_DIR, "users")
IMAGES_DIR = os.path.join(FLOWER_CONFIG_DIR, "images")
PRODUCTS_IMAGES_DIR = os.path.join(FLOWER_CONFIG_DIR, "products", "images")
PRODUCT_IMAGES_DIR = IMAGES_DIR

# API URL Prefixes chuẩn hóa
API_V1_PREFIX = "/api/flower/v1"
FLOWER_IMAGE_URL_PREFIX = f"{API_V1_PREFIX}/images"

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(PRODUCTS_IMAGES_DIR, exist_ok=True)


# File paths chuẩn hóa
USERS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "staff_users.json") if os.path.exists(os.path.join(FLOWER_CONFIG_DIR, "staff_users.json")) else os.path.join(FLOWER_CONFIG_DIR, "users.json")
STAFF_USERS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "staff_users.json")
CUSTOMERS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "customers.json")
BRANCHES_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "branches.json")
PRODUCTS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "products.json")
CATEGORIES_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "categories.json")
PRICE_LEVELS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "price_levels.json")
PROMOTIONS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "promotions.json")
TRANSLATIONS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "translations.json")
WASTAGE_REPORTS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "wastage_reports.json")
COMPANY_INFO_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "infoCompany.json")
BANNERS_FILE_PATH = os.path.join(FLOWER_CONFIG_DIR, "banners.json")

# File cache version - dùng để đồng bộ cache giữa các workers / instances
CACHE_VERSION_FILE = os.path.join(FLOWER_CONFIG_DIR, "cache_version.json")

# Log thông tin debug cấu hình ra stdout (hiện ngay trong Docker console)
print(f"[FLOWER CONFIG] ROOT_DIR: {ROOT_DIR}", flush=True)
print(f"[FLOWER CONFIG] FLOWER_CONFIG_DIR: {FLOWER_CONFIG_DIR} (exists: {os.path.exists(FLOWER_CONFIG_DIR)})", flush=True)
print(f"[FLOWER CONFIG] STAFF_USERS_FILE_PATH: {STAFF_USERS_FILE_PATH} (exists: {os.path.exists(STAFF_USERS_FILE_PATH)})", flush=True)
print(f"[FLOWER CONFIG] CUSTOMERS_FILE_PATH: {CUSTOMERS_FILE_PATH} (exists: {os.path.exists(CUSTOMERS_FILE_PATH)})", flush=True)
print(f"[FLOWER CONFIG] PRODUCTS_FILE_PATH: {PRODUCTS_FILE_PATH} (exists: {os.path.exists(PRODUCTS_FILE_PATH)})", flush=True)
print(f"[FLOWER CONFIG] BRANCHES_FILE_PATH: {BRANCHES_FILE_PATH} (exists: {os.path.exists(BRANCHES_FILE_PATH)})", flush=True)

logger.info(f"[FLOWER CONFIG] FLOWER_CONFIG_DIR: {FLOWER_CONFIG_DIR}")

