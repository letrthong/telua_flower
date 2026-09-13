import json
import urllib.request
import urllib.error
import urllib.parse
from typing import Any, Dict, Optional


class ApiResponse:
    """Đóng gói kết quả phản hồi từ HTTP API."""
    def __init__(self, status_code: int, data: Any, raw_text: str, headers: Dict[str, str]):
        self.status_code = status_code
        self.data = data
        self.raw_text = raw_text
        self.headers = headers
        self.is_success = 200 <= status_code < 300

    def __repr__(self):
        return f"<ApiResponse [{self.status_code}] success={self.is_success}>"


class TestHttpClient:
    """
    HTTP Client độc lập zero-dependency cho System & E2E Testing.
    Sử dụng urllib chuẩn của Python, chạy được trên mọi môi trường (Windows/Linux/CI).
    """
    def __init__(self, base_url: str, default_headers: Optional[Dict[str, str]] = None, timeout: float = 5.0):
        self.base_url = base_url.rstrip("/")
        self.default_headers = default_headers or {}
        self.timeout = timeout
        self.auth_token: Optional[str] = None

    def set_token(self, token: Optional[str]):
        """Thiết lập JWT Bearer token cho các request tiếp theo."""
        self.auth_token = token

    def clear_token(self):
        """Xóa token xác thực."""
        self.auth_token = None

    def _build_request(self, method: str, path: str, data: Optional[Any] = None, headers: Optional[Dict[str, str]] = None) -> urllib.request.Request:
        url = f"{self.base_url}/{path.lstrip('/')}"
        req_headers = dict(self.default_headers)
        if headers:
            req_headers.update(headers)

        if self.auth_token and "Authorization" not in req_headers:
            req_headers["Authorization"] = f"Bearer {self.auth_token}"

        encoded_data = None
        if data is not None:
            if isinstance(data, (dict, list)):
                encoded_data = json.dumps(data).encode("utf-8")
                if "Content-Type" not in req_headers:
                    req_headers["Content-Type"] = "application/json"
            elif isinstance(data, str):
                encoded_data = data.encode("utf-8")
            elif isinstance(data, bytes):
                encoded_data = data

        req = urllib.request.Request(url, data=encoded_data, headers=req_headers, method=method.upper())
        return req

    def send_request(self, method: str, path: str, data: Optional[Any] = None, headers: Optional[Dict[str, str]] = None) -> ApiResponse:
        """Gửi request và nhận ApiResponse an toàn (bắt cả mã 4xx, 5xx)."""
        req = self._build_request(method, path, data, headers)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status_code = resp.status
                raw_bytes = resp.read()
                raw_text = raw_bytes.decode("utf-8", errors="replace")
                headers_dict = dict(resp.headers)
                
                try:
                    json_data = json.loads(raw_text)
                except Exception:
                    json_data = None

                return ApiResponse(status_code, json_data, raw_text, headers_dict)
        except urllib.error.HTTPError as e:
            raw_bytes = e.read()
            raw_text = raw_bytes.decode("utf-8", errors="replace")
            try:
                json_data = json.loads(raw_text)
            except Exception:
                json_data = None
            return ApiResponse(e.code, json_data, raw_text, dict(e.headers))
        except urllib.error.URLError as e:
            return ApiResponse(0, None, str(e.reason), {})
        except Exception as e:
            return ApiResponse(0, None, str(e), {})

    def get(self, path: str, headers: Optional[Dict[str, str]] = None) -> ApiResponse:
        return self.send_request("GET", path, headers=headers)

    def post(self, path: str, data: Optional[Any] = None, headers: Optional[Dict[str, str]] = None) -> ApiResponse:
        return self.send_request("POST", path, data=data, headers=headers)

    def put(self, path: str, data: Optional[Any] = None, headers: Optional[Dict[str, str]] = None) -> ApiResponse:
        return self.send_request("PUT", path, data=data, headers=headers)

    def delete(self, path: str, headers: Optional[Dict[str, str]] = None) -> ApiResponse:
        return self.send_request("DELETE", path, headers=headers)
