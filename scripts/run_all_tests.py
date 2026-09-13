import os
import sys
import time
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def run_command(cmd, name):
    print("\n" + "=" * 70)
    print(f"  [TIER] BẮT ĐẦU: {name}")
    print(f"  [CMD]  {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    print("=" * 70)
    start = time.time()
    res = subprocess.run(cmd, cwd=str(ROOT_DIR), shell=isinstance(cmd, str))
    elapsed = time.time() - start
    success = (res.returncode == 0)
    status_str = "THÀNH CÔNG (PASS)" if success else "THẤT BẠI (FAIL)"
    print(f"  --> {name}: {status_str} sau {elapsed:.2f}s (Exit code: {res.returncode})")
    return success, elapsed


def main():
    print("=" * 70)
    print("  TELUA FLOWER CONNECT - MASTER TEST SUITE RUNNER")
    print("  Quy chuẩn: Bắt buộc chạy 100% Frontend Tests, Backend Unittests, và System Tests")
    print("=" * 70)

    overall_start = time.time()
    results = []

    # 1. Frontend JavaScript Tests
    node_available = False
    try:
        chk = subprocess.run(["node", "-v"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        node_available = (chk.returncode == 0)
    except Exception:
        pass

    if node_available:
        ok_js, time_js = run_command("node --test js/unittest/*.js", "TẦNG 1: FRONTEND JAVASCRIPT TESTS")
        results.append(("Frontend JS Tests", ok_js, time_js))
    else:
        print("\n[BỎ QUA] Node.js không khả dụng trên môi trường hiện tại.")

    # 2. Backend Python Unit & Integration Tests
    ok_py_unit, time_py_unit = run_command([sys.executable, "-m", "unittest", "discover", "-s", "src/unittest", "-p", "test_*.py"], "TẦNG 2: BACKEND UNIT & INTEGRATION TESTS")
    results.append(("Backend Unit Tests", ok_py_unit, time_py_unit))

    # 3. Live Server System Tests
    ok_sys, time_sys = run_command([sys.executable, "tests/system/run_system_tests.py"], "TẦNG 3: LIVE SERVER E2E SYSTEM TESTS")
    results.append(("Live Server System Tests", ok_sys, time_sys))

    overall_elapsed = time.time() - overall_start

    print("\n" + "=" * 70)
    print("  TỔNG HỢP KẾT QUẢ KIỂM THỬ TOÀN DIỆN (FULL TEST AUDIT)")
    print("=" * 70)
    all_passed = True
    for name, ok, t in results:
        mark = "✓ PASS" if ok else "✗ FAIL"
        if not ok:
            all_passed = False
        print(f"  {mark:<10} | {name:<30} | {t:.2f}s")
    print("-" * 70)
    print(f"  Tổng thời gian: {overall_elapsed:.2f}s")

    if all_passed:
        print("\n>>> TUYỆT VỜI: 100% TẤT CẢ CÁC BỘ TEST ĐÃ VƯỢT QUA (ZERO-REGRESSION) <<<\n")
        return 0
    else:
        print("\n>>> CẢNH BÁO: CÓ BÀI TEST THẤT BẠI! VUI LÒNG KHẮC PHỤC TRƯỚC KHI BÀN GIAO <<<\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
