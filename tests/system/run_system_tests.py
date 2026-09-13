import os
import sys
import time
import unittest
from pathlib import Path

# Đảm bảo đường dẫn import
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent.parent
SRC_DIR = PROJECT_ROOT / "src"

if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

# Đảm bảo mã hóa UTF-8 cho console stdout trên Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Bật cờ test mode
os.environ["FLOWER_TEST_MODE"] = "1"


def run_system_tests() -> int:
    """
    Điều phối thực thi bộ kiểm thử hệ thống (System Testing & E2E Live Server).
    Trả về mã thoát 0 nếu thành công 100%, hoặc 1 nếu có lỗi.
    """
    print("=" * 70)
    print("  TELUA FLOWER CONNECT - SYSTEM TESTING RUNNER (CI / E2E)")
    print("  Mục tiêu: Đảm bảo toàn bộ hệ thống hoạt động không lỗi trên TCP Live Server")
    print("=" * 70)

    start_time = time.time()

    # Load test suite
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromName("test_live_server_system.TestLiveServerSystem")

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    elapsed = time.time() - start_time
    print("-" * 70)
    print(f"Tổng số bài test hệ thống: {result.testsRun}")
    print(f"Thành công: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Thất bại: {len(result.failures)}")
    print(f"Lỗi hệ thống: {len(result.errors)}")
    print(f"Thời gian thực thi: {elapsed:.2f}s")
    print("=" * 70)

    if result.wasSuccessful():
        print(">>> KẾT QUẢ: TOÀN BỘ BÀI TEST HỆ THỐNG ĐÃ VƯỢT QUA (100% PASS - ZERO REGRESSION) <<<")
        return 0
    else:
        print(">>> KẾT QUẢ: PHÁT HIỆN LỖI TRONG KIỂM THỬ HỆ THỐNG! VUI LÒNG KIỂM TRA LẠI LOGS <<<")
        return 1


if __name__ == "__main__":
    exit_code = run_system_tests()
    sys.exit(exit_code)
