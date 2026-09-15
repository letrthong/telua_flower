# -*- coding: utf-8 -*-
"""Unit tests for Store Operating Hours parsing, validation, and realtime operating status."""

import unittest
import re
from datetime import datetime, time


def parse_operating_hours(hours_str):
    """
    Phân tích chuỗi giờ mở cửa thành (open_time, close_time).
    Ví dụ: '07:30 - 21:00' -> (time(7, 30), time(21, 0))
           'Thứ 2 - Chủ Nhật: 7:00 - 21:00' -> (time(7, 0), time(21, 0))
    """
    if not hours_str or not isinstance(hours_str, str):
        return None, None
    match = re.search(r"(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})", hours_str)
    if not match:
        return None, None
    h1, m1, h2, m2 = map(int, match.groups())
    if not (0 <= h1 <= 23 and 0 <= m1 <= 59 and 0 <= h2 <= 23 and 0 <= m2 <= 59):
        return None, None
    return time(h1, m1), time(h2, m2)


def get_store_operating_status(hours_str, check_time=None):
    """
    Xác định trạng thái hoạt động của cửa hàng dựa trên giờ mở cửa và thời gian hiện tại.
    Trả về:
      - 'closed_before_open': Chưa tới giờ mở cửa
      - 'open': Đang mở cửa bình thường
      - 'closing_soon': Sắp đóng cửa (còn < 30 phút)
      - 'closed': Đã qua giờ đóng cửa
      - 'unknown': Không parse được giờ
    """
    open_t, close_t = parse_operating_hours(hours_str)
    if not open_t or not close_t:
        return {"status": "unknown", "label": "Không xác định"}

    if check_time is None:
        check_time = datetime.now().time()
    elif isinstance(check_time, datetime):
        check_time = check_time.time()

    current_minutes = check_time.hour * 60 + check_time.minute
    open_minutes = open_t.hour * 60 + open_t.minute
    close_minutes = close_t.hour * 60 + close_t.minute

    if current_minutes < open_minutes:
        return {
            "status": "closed_before_open",
            "label": "Chưa mở cửa",
            "openTime": f"{open_t.hour:02d}:{open_t.minute:02d}",
            "closeTime": f"{close_t.hour:02d}:{close_t.minute:02d}"
        }
    elif current_minutes >= close_minutes:
        return {
            "status": "closed",
            "label": "Đã đóng cửa",
            "openTime": f"{open_t.hour:02d}:{open_t.minute:02d}",
            "closeTime": f"{close_t.hour:02d}:{close_t.minute:02d}"
        }
    elif current_minutes >= (close_minutes - 30):
        remaining = close_minutes - current_minutes
        return {
            "status": "closing_soon",
            "label": f"Sắp đóng cửa ({remaining} phút nữa)",
            "openTime": f"{open_t.hour:02d}:{open_t.minute:02d}",
            "closeTime": f"{close_t.hour:02d}:{close_t.minute:02d}"
        }
    else:
        return {
            "status": "open",
            "label": "Đang mở cửa",
            "openTime": f"{open_t.hour:02d}:{open_t.minute:02d}",
            "closeTime": f"{close_t.hour:02d}:{close_t.minute:02d}"
        }


class TestStoreOperatingHours(unittest.TestCase):
    """Kiểm thử chuẩn hóa giờ mở cửa hh:mm và trạng thái đóng/mở thời gian thực."""

    def test_parse_valid_hours_simple(self):
        o, c = parse_operating_hours("07:30 - 21:00")
        self.assertEqual(o, time(7, 30))
        self.assertEqual(c, time(21, 0))

    def test_parse_valid_hours_with_days_prefix(self):
        o, c = parse_operating_hours("Thứ 2 - Chủ Nhật: 7:00 - 21:00")
        self.assertEqual(o, time(7, 0))
        self.assertEqual(c, time(21, 0))

    def test_parse_invalid_hours(self):
        o, c = parse_operating_hours("Liên hệ hotline")
        self.assertIsNone(o)
        self.assertIsNone(c)

    def test_status_closed_before_open(self):
        # Mở lúc 07:30, kiểm tra lúc 06:45
        res = get_store_operating_status("07:30 - 21:00", time(6, 45))
        self.assertEqual(res["status"], "closed_before_open")
        self.assertEqual(res["label"], "Chưa mở cửa")

    def test_status_open(self):
        # Mở lúc 07:30 - 21:00, kiểm tra lúc 14:15
        res = get_store_operating_status("07:30 - 21:00", time(14, 15))
        self.assertEqual(res["status"], "open")
        self.assertEqual(res["label"], "Đang mở cửa")

    def test_status_closing_soon(self):
        # Mở lúc 07:30 - 21:00, kiểm tra lúc 20:45 (còn 15 phút)
        res = get_store_operating_status("07:30 - 21:00", time(20, 45))
        self.assertEqual(res["status"], "closing_soon")
        self.assertIn("15 phút nữa", res["label"])

    def test_status_closed_after_close_time(self):
        # Mở lúc 07:30 - 21:00, kiểm tra lúc 21:05
        res = get_store_operating_status("07:30 - 21:00", time(21, 5))
        self.assertEqual(res["status"], "closed")
        self.assertEqual(res["label"], "Đã đóng cửa")

    def test_status_midnight_after_close(self):
        # Mở lúc 08:00 - 21:30, kiểm tra lúc 23:59
        res = get_store_operating_status("08:00 - 21:30", time(23, 59))
        self.assertEqual(res["status"], "closed")


if __name__ == "__main__":
    unittest.main()
