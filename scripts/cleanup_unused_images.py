#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script Dọn Dẹp Ảnh Rác / Ảnh Không Còn Sử Dụng (Unused Image Cleanup Utility)
Dự Án: Nở Hoa Thả Bình (telua_flower)

Công dụng:
- Quét toàn bộ dữ liệu cấu hình (products.json, products/*.json, orders, promotions, categories,...)
  để thu thập danh sách tất cả các ảnh đang được tham chiếu (Active Images).
- Đối soát với các thư mục lưu trữ ảnh thực tế trên đĩa để tìm ra các file ảnh rác / ảnh cũ không còn dùng.
- Hỗ trợ chế độ An Toàn (Dry-Run Preview) mặc định và chế độ Xóa Thật (--delete).
- Hỗ trợ tùy chọn Sao lưu dự phòng (--backup-dir) trước khi xóa.
"""

import os
import sys
import re
import json
import shutil
import argparse
from typing import Set, List, Dict, Any, Tuple

# Đảm bảo console Windows in ký tự UTF-8 không bị lỗi charmap
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"}


def extract_referenced_images_from_data(data: Any, found_set: Set[str]) -> None:
    """Đệ quy quét cấu trúc dict/list/str để tìm tên file ảnh được tham chiếu."""
    if isinstance(data, dict):
        for v in data.values():
            extract_referenced_images_from_data(v, found_set)
    elif isinstance(data, list):
        for item in data:
            extract_referenced_images_from_data(item, found_set)
    elif isinstance(data, str):
        # Kiểm tra nếu chuỗi chứa đường dẫn hoặc tên file ảnh
        clean_str = data.strip().replace("\\", "/")
        if any(clean_str.lower().endswith(ext) or f"{ext}?" in clean_str.lower() for ext in IMAGE_EXTENSIONS):
            # Tách basename
            filename = os.path.basename(clean_str.split("?")[0].split("#")[0])
            if filename:
                found_set.add(filename)


def collect_referenced_images(target_path: str, verbose: bool = False) -> Set[str]:
    """
    Quét tất cả các file .json trong target_path để thu thập tất cả tên ảnh đang được sử dụng.
    """
    referenced = set()
    json_count = 0

    for root, _, files in os.walk(target_path):
        # Bỏ qua thư mục .git, node_modules, dist, .gemini
        if any(skip in root.replace("\\", "/").split("/") for skip in [".git", "node_modules", "dist", ".gemini", "brain"]):
            continue

        for f in files:
            if f.endswith(".json"):
                json_path = os.path.join(root, f)
                json_count += 1
                try:
                    with open(json_path, "r", encoding="utf-8") as fp:
                        data = json.load(fp)
                        extract_referenced_images_from_data(data, referenced)
                except Exception as e:
                    if verbose:
                        print(f"[!] Không thể đọc file JSON '{json_path}': {e}")

    # Đồng thời quét các file code giao diện tĩnh (.html, .js) nếu có ảnh cố định
    for root, _, files in os.walk(target_path):
        if any(skip in root.replace("\\", "/").split("/") for skip in [".git", "node_modules", "dist", ".gemini", "brain"]):
            continue
        for f in files:
            if f.endswith((".html", ".js")):
                code_path = os.path.join(root, f)
                try:
                    with open(code_path, "r", encoding="utf-8", errors="ignore") as fp:
                        text = fp.read()
                        # Tìm các chuỗi khớp với pattern tên ảnh
                        matches = re.findall(r'[\w\-]+\.(?:jpg|jpeg|png|webp|gif|avif|svg)', text, re.IGNORECASE)
                        for m in matches:
                            referenced.add(os.path.basename(m))
                except Exception:
                    pass

    return referenced


def scan_existing_image_files(target_path: str) -> List[Tuple[str, str, int]]:
    """
    Quét tất cả các file ảnh thực tế nằm trong các thư mục ảnh của dự án.
    Trả về danh sách tuple (abs_path, filename, size_bytes).
    """
    image_files = []

    # Nhận diện các thư mục chứa ảnh (hoặc nếu người dùng truyền trực tiếp thư mục ảnh)
    for root, _, files in os.walk(target_path):
        # Bỏ qua các thư mục không liên quan
        norm_root = root.replace("\\", "/").lower()
        if any(skip in norm_root.split("/") for skip in [".git", "node_modules", "dist", ".gemini", "brain"]):
            continue

        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in IMAGE_EXTENSIONS:
                full_path = os.path.join(root, f)
                try:
                    size = os.path.getsize(full_path)
                    image_files.append((full_path, f, size))
                except OSError:
                    pass

    return image_files


def format_bytes(size: int) -> str:
    """Định dạng byte sang KB / MB dễ đọc."""
    if size < 1024:
        return f"{size} B"
    elif size < 1024 * 1024:
        return f"{size / 1024:.2f} KB"
    else:
        return f"{size / (1024 * 1024):.2f} MB"


def cleanup_unused_images(
    target_path: str,
    delete: bool = False,
    backup_dir: str = None,
    verbose: bool = False
) -> Dict[str, Any]:
    """
    Thực thi đối soát và dọn dẹp ảnh thừa.
    """
    abs_target = os.path.abspath(target_path)
    if not os.path.exists(abs_target):
        print(f"❌ LỖI: Đường dẫn không tồn tại: {abs_target}")
        return {"success": False, "message": "Path not found"}

    print("=" * 70)
    print(f"🌸 TELUA FLOWER - CÔNG CỤ DỌN DẸP ẢNH RÁC / ẢNH CŨ KHÔNG DÙNG")
    print(f"📁 Thư mục quét: {abs_target}")
    print(f"⚙️  Chế độ: {'🚨 XÓA THẬT (--delete)' if delete else '🛡️  XEM TRƯỚC (DRY-RUN - An Toàn, không xóa file)'}")
    if backup_dir:
        print(f"📦 Thư mục sao lưu: {os.path.abspath(backup_dir)}")
    print("=" * 70)

    # 1. Thu thập tất cả ảnh đang được tham chiếu
    print("\n🔍 Bước 1/3: Đang quét cấu hình JSON, HTML, JS để tìm ảnh đang sử dụng...")
    referenced_images = collect_referenced_images(abs_target, verbose=verbose)
    print(f"   -> Tìm thấy {len(referenced_images)} ảnh đang được hệ thống tham chiếu.")

    # 2. Quét tất cả file ảnh thực tế trên đĩa
    print("\n📦 Bước 2/3: Đang quét các file ảnh thực tế có trên ổ đĩa...")
    existing_images = scan_existing_image_files(abs_target)
    print(f"   -> Tìm thấy {len(existing_images)} file ảnh trên ổ đĩa.")

    # 3. Phân loại ảnh thừa
    unused_images = []
    active_images = []
    total_unused_size = 0

    for full_path, filename, size in existing_images:
        # Nếu file ảnh không có trong danh sách được tham chiếu
        if filename not in referenced_images:
            unused_images.append((full_path, filename, size))
            total_unused_size += size
        else:
            active_images.append((full_path, filename, size))

    print("\n📊 Bước 3/3: Kết quả phân tích đối soát:")
    print(f"   - 🟢 Ảnh đang sử dụng (Active): {len(active_images)} files")
    print(f"   - 🔴 Ảnh thừa / Không dùng (Unused): {len(unused_images)} files ({format_bytes(total_unused_size)})")

    if unused_images:
        print("\n📋 Danh sách file ảnh thừa có thể dọn dẹp:")
        for idx, (fpath, fname, fsize) in enumerate(unused_images, 1):
            rel_path = os.path.relpath(fpath, abs_target)
            print(f"   {idx:2d}. {fname:<40} [{format_bytes(fsize):>9}] -> {rel_path}")

    # 4. Thực hiện xóa nếu có cờ --delete
    deleted_count = 0
    deleted_size = 0
    if delete and unused_images:
        print("\n⚠️  ĐANG TIẾN HÀNH XỬ LÝ XÓA...")
        if backup_dir:
            os.makedirs(backup_dir, exist_ok=True)

        for fpath, fname, fsize in unused_images:
            try:
                if backup_dir:
                    rel_p = os.path.relpath(fpath, abs_target)
                    b_dest = os.path.join(backup_dir, rel_p)
                    os.makedirs(os.path.dirname(b_dest), exist_ok=True)
                    shutil.move(fpath, b_dest)
                else:
                    os.remove(fpath)

                deleted_count += 1
                deleted_size += fsize
            except Exception as e:
                print(f"   ❌ Không thể xóa '{fname}': {e}")

        action_word = "Đã sao lưu & di chuyển" if backup_dir else "Đã xóa vĩnh viễn"
        print(f"\n✅ {action_word} thành công: {deleted_count}/{len(unused_images)} files ({format_bytes(deleted_size)})")
    elif not delete and unused_images:
        print("\n💡 GỢI Ý:")
        print("   Đây là chế độ xem trước (Dry-Run). Để thực hiện xóa thật, hãy thêm cờ: --delete")
        print("   Ví dụ: python scripts/cleanup_unused_images.py --path . --delete")
        print("   Hoặc kèm backup: python scripts/cleanup_unused_images.py --path . --delete --backup-dir ./backup_images")
    else:
        print("\n✨ Tuyệt vời! Thư mục hoàn toàn sạch sẽ, không có ảnh rác nào.")

    print("=" * 70)
    return {
        "success": True,
        "referenced_count": len(referenced_images),
        "existing_count": len(existing_images),
        "unused_count": len(unused_images),
        "unused_bytes": total_unused_size,
        "deleted_count": deleted_count
    }


def main():
    parser = argparse.ArgumentParser(
        description="🌸 Quét và dọn dẹp các file ảnh thừa / ảnh cũ không còn sử dụng trong dự án telua_flower."
    )
    parser.add_argument(
        "path",
        nargs="?",
        default=DEFAULT_ROOT_DIR,
        help="Đường dẫn thư mục dự án hoặc thư mục config cần quét (Mặc định: Thư mục gốc dự án)."
    )
    parser.add_argument(
        "-p", "--path",
        dest="opt_path",
        default=None,
        help="Tùy chọn chỉ định đường dẫn thư mục quét (thay thế positional argument)."
    )
    parser.add_argument(
        "-d", "--delete",
        action="store_true",
        help="Thực thi xóa thật các file ảnh thừa (nếu không truyền cờ này, script chạy ở chế độ An Toàn Dry-Run)."
    )
    parser.add_argument(
        "-b", "--backup-dir",
        default=None,
        help="Đường dẫn thư mục sao lưu ảnh trước khi xóa (phòng hờ cần khôi phục)."
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="In chi tiết log quét từng file."
    )

    args = parser.parse_args()
    target_path = args.opt_path if args.opt_path else args.path

    cleanup_unused_images(
        target_path=target_path,
        delete=args.delete,
        backup_dir=args.backup_dir,
        verbose=args.verbose
    )


if __name__ == "__main__":
    main()
