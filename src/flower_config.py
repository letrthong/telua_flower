import os
import logging
from pathlib import Path

# Cấu hình logger
logger = logging.getLogger("flower_config")

# Root directory of the workspace (tương thích cross-platform: Windows & Linux /app Docker)
ROOT_DIR = Path(__file__).resolve().parent.parent

# Source directory
SRC_DIR = ROOT_DIR / 'src'

# Config directory (tự động nhận diện và cô lập riêng thư mục config/anne)
def _detect_config_dir() -> str:
    env_dir = os.environ.get("FLOWER_CONFIG_DIR")
    if env_dir:
        os.makedirs(env_dir, exist_ok=True)
        return env_dir
    
    # 1. Tìm thư mục config/anne từ root project workspace
    current = Path(__file__).resolve()
    for parent in current.parents:
        candidate = parent / "config"
        if candidate.exists():
            target = candidate / "anne"
            target.mkdir(parents=True, exist_ok=True)
            return str(target)

    # 2. Kiểm tra /app/config/anne trong môi trường Docker Linux
    if os.name != 'nt' and os.path.exists("/app/config"):
        target = "/app/config/anne"
        os.makedirs(target, exist_ok=True)
        return target
            
    # 3. Fallback thư mục config ngay tại Controller/anne/config
    fallback = Path(__file__).resolve().parent / "config"
    fallback.mkdir(parents=True, exist_ok=True)
    return str(fallback)

FLOWER_CONFIG_DIR = _detect_config_dir()

# Sub-directories
FLOWER_ORDERS_DIR = os.path.join(FLOWER_CONFIG_DIR, "orders")
PRODUCTS_DIR = os.path.join(FLOWER_CONFIG_DIR, "products")
USERS_DIR = os.path.join(FLOWER_CONFIG_DIR, "users")

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

