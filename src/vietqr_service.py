"""
VietQR Payment Service - Chuẩn Napas 247 EMVCo QR Code
Dự án: Nở Hoa Thả Bình (telua_flower)

Dịch vụ tạo chuỗi thanh toán VietQR động chuẩn EMVCo,
hỗ trợ sinh QuickLink URL và mã QR Base64 trực tiếp cho quy trình đặt hoa.
"""

import os
import io
import json
import base64
import urllib.parse
from typing import Optional, Dict, Any

from flower_config import COMPANY_INFO_FILE_PATH

# ==========================================
# CẤU HÌNH NGÂN HÀNG MẶC ĐỊNH (HARDCODE DỰ PHÒNG)
# ==========================================
DEFAULT_BANK_CONFIG = {
    "bank_code": "MB",                       # Mã viết tắt ngân hàng (MB, VCB, TCB, VPB, ACB, ICB,...)
    "bank_bin": "970422",                    # Mã BIN Napas (MBBank: 970422, Vietcombank: 970436, Techcombank: 970407)
    "bank_name": "MBBank (Ngân hàng Quân Đội)",
    "account_number": "0976491323",          # Số tài khoản thụ hưởng
    "account_name": "NO HOA THA BINH",       # Tên chủ tài khoản (Viết hoa không dấu)
    "transfer_prefix": "NHTB"                # Tiền tố nội dung chuyển khoản (Nở Hoa Thả Bình)
}


def get_default_bank_config() -> Dict[str, str]:
    """
    Lấy thông tin tài khoản ngân hàng cấu hình.
    Ưu tiên lấy thông tin cấu hình từ infoCompany.json nếu có, fallback về DEFAULT_BANK_CONFIG.
    """
    config = dict(DEFAULT_BANK_CONFIG)
    if os.path.exists(COMPANY_INFO_FILE_PATH):
        try:
            with open(COMPANY_INFO_FILE_PATH, "r", encoding="utf-8") as f:
                company_data = json.load(f)
                if "bankConfig" in company_data and isinstance(company_data["bankConfig"], dict):
                    config.update(company_data["bankConfig"])
        except Exception:
            pass
    return config


def _crc16_ccitt(data: str) -> str:
    """
    Tính mã kiểm tra CRC-16/CCITT-FALSE (Chuẩn EMVCo / VietQR).
    Polynomial: 0x1021, Init: 0xFFFF.
    """
    crc = 0xFFFF
    for byte in data.encode("utf-8"):
        crc ^= (byte << 8)
        for _ in range(8):
            if crc & 0x8000:
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF
            else:
                crc = (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _format_tlv(tag: str, value: str) -> str:
    """Đóng gói dữ liệu theo chuẩn EMVCo TLV (Tag - Length - Value)."""
    length = f"{len(value.encode('utf-8')):02d}"
    return f"{tag}{length}{value}"


def generate_vietqr_payload(
    amount: Optional[int] = None,
    order_code: str = "",
    bank_bin: Optional[str] = None,
    account_number: Optional[str] = None,
    transfer_prefix: Optional[str] = None
) -> str:
    """
    Sinh chuỗi dữ liệu VietQR chuẩn EMVCo Napas.
    
    Cấu trúc Napas QR:
    - 00: Payload Format Indicator ("01")
    - 01: Point of Initiation Method ("11" tĩnh, "12" động có số tiền)
    - 38: Merchant Account Information (Napas GUID + Bank BIN + Account Number + QRIBFTTA)
    - 53: Transaction Currency ("704" - VND)
    - 54: Transaction Amount
    - 58: Country Code ("VN")
    - 62: Additional Data Field (Nội dung chuyển khoản / Mã đơn hàng)
    - 63: CRC16 Checksum
    """
    cfg = get_default_bank_config()
    bin_val = bank_bin or cfg["bank_bin"]
    acc_val = account_number or cfg["account_number"]
    pfx_val = transfer_prefix or cfg.get("transfer_prefix", "NHTB")

    # 00: Phiên bản payload
    payload = _format_tlv("00", "01")
    # 01: Loại QR (11: Tĩnh, 12: Động - có số tiền cụ thể)
    payload += _format_tlv("01", "12" if (amount and amount > 0) else "11")

    # 38: Thông tin người thụ hưởng (Napas 247 chuyển nhanh tài khoản)
    napas_guid = _format_tlv("00", "A000000727")
    sub_bank = _format_tlv("00", bin_val) + _format_tlv("01", acc_val)
    napas_account = _format_tlv("01", sub_bank)
    service_code = _format_tlv("02", "QRIBFTTA")
    
    merchant_info = napas_guid + napas_account + service_code
    payload += _format_tlv("38", merchant_info)

    # 53: Tiền tệ (704 = VND)
    payload += _format_tlv("53", "704")

    # 54: Số tiền thanh toán (nếu có)
    if amount and amount > 0:
        payload += _format_tlv("54", str(int(amount)))

    # 58: Quốc gia (VN)
    payload += _format_tlv("58", "VN")

    # 62: Nội dung chuyển khoản (Additional Data Field)
    if order_code:
        # Chuẩn hóa cú pháp: "NHTB <order_code>"
        clean_code = "".join(c for c in order_code if c.isalnum() or c in "-_")
        full_memo = f"{pfx_val} {clean_code}".strip()[:25]
        sub_memo = _format_tlv("08", full_memo)
        payload += _format_tlv("62", sub_memo)

    # 63: Checksum CRC16
    payload_to_crc = payload + "6304"
    crc_value = _crc16_ccitt(payload_to_crc)
    
    return payload_to_crc + crc_value


def get_vietqr_quicklink(
    amount: int,
    order_code: str,
    bank_code: Optional[str] = None,
    account_number: Optional[str] = None,
    account_name: Optional[str] = None,
    template: str = "compact2"
) -> str:
    """
    Sinh URL hình ảnh VietQR trực tiếp (dùng để nhúng vào thẻ <img> trên Web/Mobile App).
    """
    cfg = get_default_bank_config()
    b_code = bank_code or cfg["bank_code"]
    acc_num = account_number or cfg["account_number"]
    acc_name = account_name or cfg["account_name"]
    pfx = cfg.get("transfer_prefix", "NHTB")

    clean_code = "".join(c for c in order_code if c.isalnum() or c in "-_")
    memo = f"{pfx} {clean_code}".strip()
    
    memo_encoded = urllib.parse.quote(memo)
    name_encoded = urllib.parse.quote(acc_name)
    
    return (
        f"https://img.vietqr.io/image/{b_code}-{acc_num}-{template}.png"
        f"?amount={int(amount)}&addInfo={memo_encoded}&accountName={name_encoded}"
    )


def generate_vietqr_base64(payload: str) -> str:
    """
    Sinh ảnh QR code dưới dạng Base64 Data URL (nếu môi trường có cài đặt qrcode).
    """
    try:
        import qrcode
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{img_str}"
    except Exception:
        return ""


def build_order_payment_info(
    order_code: str,
    total_amount: int,
    method: str = "vietqr"
) -> Dict[str, Any]:
    """
    Xây dựng cấu trúc thanh toán đầy đủ cho đơn hàng,
    tự động gắn thông tin VietQR nếu method là 'vietqr'.
    """
    cfg = get_default_bank_config()
    clean_code = "".join(c for c in order_code if c.isalnum() or c in "-_")
    transfer_content = f"{cfg.get('transfer_prefix', 'NHTB')} {clean_code}".strip()

    payment_info: Dict[str, Any] = {
        "method": method,
        "status": "unpaid",
        "transactionId": None,
        "paidAt": None
    }

    if method == "vietqr":
        qr_payload = generate_vietqr_payload(
            amount=total_amount,
            order_code=order_code,
            bank_bin=cfg["bank_bin"],
            account_number=cfg["account_number"]
        )
        quicklink = get_vietqr_quicklink(
            amount=total_amount,
            order_code=order_code,
            bank_code=cfg["bank_code"],
            account_number=cfg["account_number"],
            account_name=cfg["account_name"]
        )
        qr_base64 = generate_vietqr_base64(qr_payload)

        payment_info.update({
            "bankInfo": {
                "bankName": cfg["bank_name"],
                "bankCode": cfg["bank_code"],
                "bankBin": cfg["bank_bin"],
                "accountNumber": cfg["account_number"],
                "accountName": cfg["account_name"]
            },
            "transferContent": transfer_content,
            "vietqr": {
                "payload": qr_payload,
                "quickLink": quicklink,
                "qrBase64": qr_base64 if qr_base64 else None
            }
        })

    return payment_info
