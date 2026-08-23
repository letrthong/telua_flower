import os
import logging
from pathlib import Path

# Cấu hình logger
logger = logging.getLogger("flower_config")

# Root directory of the workspace (tương thích cross-platform: Windows & Linux /app Docker)
ROOT_DIR = Path(__file__).resolve().parent.parent

# Source directory
SRC_DIR = ROOT_DIR / 'src'

# Config directory (tự động nhận diện thư mục config / config/anne)
if os.path.exists("/app/config/anne"):
    FLOWER_CONFIG_DIR = "/app/config/anne"
elif os.path.exists("/app/config"):
    FLOWER_CONFIG_DIR = "/app/config"
elif (ROOT_DIR / 'config' / 'anne').exists():
    FLOWER_CONFIG_DIR = str(ROOT_DIR / 'config' / 'anne')
else:
    FLOWER_CONFIG_DIR = str(ROOT_DIR / 'config')

# Sub-directories
FLOWER_ORDERS_DIR = os.path.join(FLOWER_CONFIG_DIR, "orders")
PRODUCTS_DIR = os.path.join(FLOWER_CONFIG_DIR, "products")

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

# File cache version - dùng để đồng bộ cache giữa các workers / instances
CACHE_VERSION_FILE = os.path.join(FLOWER_CONFIG_DIR, "cache_version.json")

# Log thông tin debug cấu hình
logger.info(f"🌸 [FLOWER CONFIG] ROOT_DIR: {ROOT_DIR}")
logger.info(f"🌸 [FLOWER CONFIG] FLOWER_CONFIG_DIR: {FLOWER_CONFIG_DIR} (Tồn tại: {os.path.exists(FLOWER_CONFIG_DIR)})")
logger.info(f"🌸 [FLOWER CONFIG] PRODUCTS_FILE_PATH: {PRODUCTS_FILE_PATH} (Tồn tại: {os.path.exists(PRODUCTS_FILE_PATH)})")

