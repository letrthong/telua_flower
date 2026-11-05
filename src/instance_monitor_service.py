# -*- coding: utf-8 -*-
"""
Dịch Vụ Giám Sát Cụm & Instances Phân Tải (Load Balancer & Cluster Monitor Service)
Quản lý cấu hình array instances (instancesMonitor.json) phục vụ hệ thống chạy đa tiến trình/container/node.
"""

import os
import sys
import json
import time
import socket
import platform
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flower_config import FLOWER_CONFIG_DIR

CONFIG_DIR = FLOWER_CONFIG_DIR
MONITOR_FILE = "instancesMonitor.json"

_IO_LOCK = threading.Lock()
_BOOT_TIME_SEC = time.time()
_BOOT_TIME_ISO = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
_REQUEST_COUNTER = 0
_REQUEST_COUNTER_LOCK = threading.Lock()

_LAST_CPU_SAMPLE: Dict[str, float] = {
    "ts": time.time(),
    "user": 0.0,
    "system": 0.0
}
try:
    _init_times = os.times()
    _LAST_CPU_SAMPLE["user"] = _init_times.user
    _LAST_CPU_SAMPLE["system"] = _init_times.system
except Exception:
    pass


_CACHED_INSTANCE_ID: Optional[str] = None
_CACHED_INSTANCE_NAME: Optional[str] = None


def increment_request_counter() -> int:
    """Tăng số lượng request đã phục vụ bởi instance này."""
    global _REQUEST_COUNTER
    with _REQUEST_COUNTER_LOCK:
        _REQUEST_COUNTER += 1
        return _REQUEST_COUNTER


def get_current_request_count() -> int:
    """Lấy số lượng request đã phục vụ."""
    return _REQUEST_COUNTER


def get_instance_identity_filepath() -> str:
    """Đường dẫn lưu file định danh instance cục bộ trên máy/container (không lưu trong volume chung)."""
    import tempfile
    custom_path = os.environ.get("INSTANCE_ID_FILE")
    if custom_path and custom_path.strip():
        return custom_path.strip()
    return os.path.join(tempfile.gettempdir(), ".telua_instance_id")


def get_current_instance_id() -> str:
    """
    Trả về định danh duy nhất của instance hiện tại và đảm bảo KHÔNG bị gen lại.
    Thứ tự ưu tiên:
    1. Bộ nhớ RAM process (_CACHED_INSTANCE_ID)
    2. Biến môi trường ENV: INSTANCE_ID > CONTAINER_ID
    3. File định danh cục bộ trên ổ đĩa container (.telua_instance_id)
    4. Sinh mới theo hostname + PID và lưu vĩnh viễn vào file cục bộ
    """
    global _CACHED_INSTANCE_ID
    if _CACHED_INSTANCE_ID:
        return _CACHED_INSTANCE_ID

    # 1. Kiểm tra biến môi trường
    env_id = os.environ.get("INSTANCE_ID") or os.environ.get("CONTAINER_ID")
    if env_id and env_id.strip():
        _CACHED_INSTANCE_ID = env_id.strip()
        return _CACHED_INSTANCE_ID

    # 2. Kiểm tra file định danh cục bộ đã lưu trước đó trên container
    id_file = get_instance_identity_filepath()
    try:
        if os.path.isfile(id_file):
            with open(id_file, "r", encoding="utf-8") as f:
                saved_id = f.read().strip()
                if saved_id:
                    _CACHED_INSTANCE_ID = saved_id
                    return _CACHED_INSTANCE_ID
    except Exception:
        pass

    # 3. Sinh ID mới 1 lần duy nhất và lưu vào file cục bộ
    hostname = socket.gethostname() or "node"
    generated_id = f"node-{hostname}-{os.getpid()}"
    try:
        os.makedirs(os.path.dirname(id_file), exist_ok=True)
        with open(id_file, "w", encoding="utf-8") as f:
            f.write(generated_id)
    except Exception:
        pass

    _CACHED_INSTANCE_ID = generated_id
    return _CACHED_INSTANCE_ID


def get_current_instance_name() -> str:
    """Trả về tên gợi nhớ của instance (VD: Node-01, Worker-A)."""
    global _CACHED_INSTANCE_NAME
    if _CACHED_INSTANCE_NAME:
        return _CACHED_INSTANCE_NAME

    env_name = os.environ.get("INSTANCE_NAME") or os.environ.get("NODE_NAME")
    if env_name and env_name.strip():
        _CACHED_INSTANCE_NAME = env_name.strip()
        return _CACHED_INSTANCE_NAME

    inst_id = get_current_instance_id()
    _CACHED_INSTANCE_NAME = inst_id.replace("node-", "Node-")
    return _CACHED_INSTANCE_NAME


def get_current_instance_host() -> str:
    """Trả về IP hoặc hostname của instance."""
    env_host = os.environ.get("INSTANCE_HOST") or os.environ.get("HOST_IP")
    if env_host and env_host.strip():
        return env_host.strip()
    try:
        return socket.gethostbyname(socket.gethostname())
    except Exception:
        return socket.gethostname() or "127.0.0.1"


def get_current_instance_port() -> int:
    """Trả về cổng lắng nghe của instance."""
    for p in ("PORT", "FLOWER_PORT", "SERVER_PORT"):
        val = os.environ.get(p)
        if val and val.isdigit():
            return int(val)
    return 5000


def get_process_memory_mb() -> Optional[float]:
    """Đo lường bộ nhớ RAM (RSS) của tiến trình hiện tại (Cross-platform: Windows/Linux/Docker)."""
    # 1. Linux (/proc/self/status)
    if os.path.exists("/proc/self/status"):
        try:
            with open("/proc/self/status", "r", encoding="utf-8") as f:
                for line in f:
                    if line.startswith("VmRSS:"):
                        parts = line.split()
                        if len(parts) >= 2 and parts[1].isdigit():
                            return round(int(parts[1]) / 1024.0, 1)
        except Exception:
            pass

    # 2. Windows (psapi / kernel32 GetProcessMemoryInfo)
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            class PROCESS_MEMORY_COUNTERS_EX(ctypes.Structure):
                _fields_ = [
                    ("cb", wintypes.DWORD),
                    ("PageFaultCount", wintypes.DWORD),
                    ("PeakWorkingSetSize", ctypes.c_size_t),
                    ("WorkingSetSize", ctypes.c_size_t),
                    ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                    ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                    ("PagefileUsage", ctypes.c_size_t),
                    ("PeakPagefileUsage", ctypes.c_size_t),
                    ("PrivateUsage", ctypes.c_size_t),
                ]

            kernel32 = ctypes.WinDLL("kernel32.dll")
            psapi = ctypes.WinDLL("psapi.dll")
            hProcess = kernel32.GetCurrentProcess()
            counters = PROCESS_MEMORY_COUNTERS_EX()
            counters.cb = ctypes.sizeof(PROCESS_MEMORY_COUNTERS_EX)

            GetMemInfo = getattr(kernel32, "K32GetProcessMemoryInfo", getattr(psapi, "GetProcessMemoryInfo", None))
            if GetMemInfo:
                GetMemInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESS_MEMORY_COUNTERS_EX), wintypes.DWORD]
                GetMemInfo.restype = wintypes.BOOL
                if GetMemInfo(hProcess, ctypes.byref(counters), counters.cb):
                    return round(counters.WorkingSetSize / (1024.0 * 1024.0), 1)
        except Exception:
            pass

    return None


def get_system_memory_info() -> Optional[Dict[str, Any]]:
    """Đo lường tổng RAM và RAM sử dụng trên hệ thống host/server."""
    # 1. Linux (/proc/meminfo)
    if os.path.exists("/proc/meminfo"):
        try:
            mem = {}
            with open("/proc/meminfo", "r", encoding="utf-8") as f:
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        k = parts[0].strip()
                        v = parts[1].strip().split()[0]
                        if v.isdigit():
                            mem[k] = int(v)
            if "MemTotal" in mem:
                total_mb = round(mem["MemTotal"] / 1024.0, 1)
                avail_mb = round(mem.get("MemAvailable", mem.get("MemFree", 0)) / 1024.0, 1)
                used_mb = round(max(total_mb - avail_mb, 0.0), 1)
                pct = round((used_mb / total_mb) * 100.0, 1) if total_mb > 0 else 0.0
                return {
                    "totalMb": total_mb,
                    "usedMb": used_mb,
                    "freeMb": avail_mb,
                    "usagePercent": pct
                }
        except Exception:
            pass

    # 2. Windows (GlobalMemoryStatusEx)
    if sys.platform == "win32":
        try:
            import ctypes
            from ctypes import wintypes

            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", wintypes.DWORD),
                    ("dwMemoryLoad", wintypes.DWORD),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]

            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            if ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat)):
                total_mb = round(stat.ullTotalPhys / (1024.0 * 1024.0), 1)
                free_mb = round(stat.ullAvailPhys / (1024.0 * 1024.0), 1)
                used_mb = round(max(total_mb - free_mb, 0.0), 1)
                return {
                    "totalMb": total_mb,
                    "usedMb": used_mb,
                    "freeMb": free_mb,
                    "usagePercent": float(stat.dwMemoryLoad)
                }
        except Exception:
            pass

    return None


def get_process_cpu_percent() -> float:
    """Tính % CPU sử dụng của tiến trình bằng delta user + system time."""
    global _LAST_CPU_SAMPLE
    try:
        now = time.time()
        t = os.times()
        dt = now - _LAST_CPU_SAMPLE["ts"]
        proc_dt = (t.user - _LAST_CPU_SAMPLE["user"]) + (t.system - _LAST_CPU_SAMPLE["system"])
        _LAST_CPU_SAMPLE = {"ts": now, "user": t.user, "system": t.system}
        if dt <= 0.05:
            return 0.0
        pct = (proc_dt / dt) * 100.0
        cores = os.cpu_count() or 1
        return round(min(max(pct, 0.0), 100.0 * cores), 1)
    except Exception:
        return 0.0


def get_system_load_average() -> Optional[List[float]]:
    """Lấy System Load Average (1m, 5m, 15m) trên Linux/Unix."""
    if hasattr(os, "getloadavg"):
        try:
            return [round(x, 2) for x in os.getloadavg()]
        except Exception:
            pass
    return None


def get_monitor_filepath() -> str:
    """Trả về đường dẫn tệp instancesMonitor.json trong thư mục config."""
    return os.path.join(CONFIG_DIR, MONITOR_FILE)


DEFAULT_CLUSTER_MONITOR: Dict[str, Any] = {
    "clusterName": "No Hoa Tha Binh Production Cluster",
    "updatedAt": "2026-11-04T00:00:00Z",
    "updatedDate": "2026-11-04",
    "loadBalancer": {
        "enabled": True,
        "provider": "Nginx / Cloudflare / AWS ALB",
        "algorithm": "Round Robin",
        "healthCheckEndpoint": "/api/flower/v1/health",
        "notes": "Hệ thống đa instance chạy phân tải sau Load Balancer"
    },
    "heartbeatIntervalSeconds": 30,
    "staleTimeoutSeconds": 90,
    "autoPruneDays": 7,
    "instances": []
}


def auto_prune_expired_instances(data: Dict[str, Any], current_id: Optional[str] = None) -> Tuple[List[Dict[str, Any]], int]:
    """
    Tự động xóa các instance không có cập nhật trong hơn 7 ngày (1 tuần).
    """
    now_ts = time.time()
    prune_days = int(data.get("autoPruneDays") or 7)
    max_age_seconds = prune_days * 86400  # 7 * 24 * 3600

    instances: List[Dict[str, Any]] = list(data.get("instances") or [])
    kept: List[Dict[str, Any]] = []
    pruned_count = 0

    for inst in instances:
        # Luôn giữ lại instance hiện tại
        if current_id and inst.get("instanceId") == current_id:
            kept.append(inst)
            continue

        last_ts = inst.get("lastHeartbeatTimestamp") or inst.get("lastUpdatedTimestamp")
        if not last_ts and (inst.get("updatedAt") or inst.get("lastHeartbeat")):
            try:
                iso_clean = (inst.get("updatedAt") or inst.get("lastHeartbeat")).replace("Z", "+00:00")
                last_ts = datetime.fromisoformat(iso_clean).timestamp()
            except Exception:
                last_ts = 0

        age = (now_ts - last_ts) if last_ts else 9999999
        if age > max_age_seconds:
            pruned_count += 1
        else:
            kept.append(inst)

    return kept, pruned_count


def read_monitor_file() -> Dict[str, Any]:
    """Đọc dữ liệu tệp instancesMonitor.json an toàn với thread lock."""
    filepath = get_monitor_filepath()
    with _IO_LOCK:
        if not os.path.exists(filepath):
            try:
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                with open(filepath, "w", encoding="utf-8") as f:
                    json.dump(DEFAULT_CLUSTER_MONITOR, f, ensure_ascii=False, indent=2)
            except Exception:
                pass
            return json.loads(json.dumps(DEFAULT_CLUSTER_MONITOR))

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
        return json.loads(json.dumps(DEFAULT_CLUSTER_MONITOR))


def write_monitor_file(data: Dict[str, Any]) -> bool:
    """Ghi dữ liệu ra tệp instancesMonitor.json an toàn."""
    filepath = get_monitor_filepath()
    with _IO_LOCK:
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            temp_path = f"{filepath}.tmp.{os.getpid()}"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            os.replace(temp_path, filepath)
            return True
        except Exception:
            return False


def collect_current_instance_metrics() -> Dict[str, Any]:
    """Thu thập thông tin hiện thời của instance này."""
    now_ts = time.time()
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    now_date = now_dt.strftime("%Y-%m-%d")
    uptime = int(now_ts - _BOOT_TIME_SEC)

    return {
        "instanceId": get_current_instance_id(),
        "name": get_current_instance_name(),
        "role": os.environ.get("INSTANCE_ROLE", "web-worker"),
        "host": get_current_instance_host(),
        "port": get_current_instance_port(),
        "pid": os.getpid(),
        "status": "online",
        "startTime": _BOOT_TIME_ISO,
        "uptimeSeconds": uptime,
        "updatedAt": now_iso,
        "updatedDate": now_date,
        "lastHeartbeat": now_iso,
        "lastHeartbeatTimestamp": now_ts,
        "version": os.environ.get("APP_VERSION", "v1.2.0"),
        "os": platform.platform(),
        "pythonVersion": platform.python_version(),
        "memoryMb": get_process_memory_mb(),
        "systemMemory": get_system_memory_info(),
        "cpuPercent": get_process_cpu_percent(),
        "cpuCores": os.cpu_count() or 1,
        "loadAvg": get_system_load_average(),
        "requestCount": get_current_request_count(),
        "notes": os.environ.get("INSTANCE_NOTES", "Node phục vụ qua Load Balancer")
    }


def heartbeat_current_instance() -> Dict[str, Any]:
    """
    Tự động ghi nhận hoặc cập nhật thông tin của instance hiện tại vào mảng instances.
    Đồng thời tự động xóa bỏ các instance không có cập nhật trong hơn 7 ngày (1 tuần).
    """
    current_metrics = collect_current_instance_metrics()
    data = read_monitor_file()

    # Tự động loại bỏ các node không cập nhật quá 7 ngày
    instances, _ = auto_prune_expired_instances(data, current_id=current_metrics["instanceId"])
    found = False
    inst_id = current_metrics["instanceId"]

    for i, inst in enumerate(instances):
        if inst.get("instanceId") == inst_id:
            # Bảo lưu một số cấu hình tuỳ biến nếu có
            current_metrics["name"] = inst.get("name") or current_metrics["name"]
            current_metrics["notes"] = inst.get("notes") or current_metrics["notes"]
            instances[i] = current_metrics
            found = True
            break

    if not found:
        instances.append(current_metrics)

    now_dt = datetime.now(timezone.utc)
    data["instances"] = instances
    data["updatedAt"] = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    data["updatedDate"] = now_dt.strftime("%Y-%m-%d")
    write_monitor_file(data)
    return current_metrics


def get_cluster_monitor_data(auto_heartbeat: bool = True) -> Dict[str, Any]:
    """
    Trả về toàn bộ dữ liệu giám sát cụm instances và tình trạng sức khỏe hệ thống.
    Đánh giá trạng thái (online, degraded, offline) dựa trên thời gian heartbeat gần nhất.
    Tự động dọn dẹp các node không cập nhật sau 7 ngày (1 tuần).
    """
    if auto_heartbeat:
        try:
            heartbeat_current_instance()
        except Exception:
            pass

    data = read_monitor_file()
    current_id = get_current_instance_id()

    # Dọn dẹp tự động các node quá 7 ngày
    pruned_instances, pruned_count = auto_prune_expired_instances(data, current_id=current_id)
    if pruned_count > 0:
        data["instances"] = pruned_instances
        write_monitor_file(data)

    now_ts = time.time()
    stale_timeout = int(data.get("staleTimeoutSeconds") or 90)

    raw_instances = data.get("instances") or []
    enriched_instances: List[Dict[str, Any]] = []

    online_count = 0
    degraded_count = 0
    offline_count = 0
    total_mem = 0.0
    total_reqs = 0

    for inst in raw_instances:
        item = dict(inst)
        last_ts = item.get("lastHeartbeatTimestamp")
        if not last_ts and item.get("lastHeartbeat"):
            try:
                # Thử parse ISO format
                iso_clean = item["lastHeartbeat"].replace("Z", "+00:00")
                last_ts = datetime.fromisoformat(iso_clean).timestamp()
            except Exception:
                last_ts = 0

        age_seconds = int(now_ts - last_ts) if last_ts else 999999
        item["ageSeconds"] = max(0, age_seconds)

        # Đánh giá trạng thái
        if age_seconds <= stale_timeout:
            status = "online"
            online_count += 1
        elif age_seconds <= (stale_timeout * 3):
            status = "degraded"
            degraded_count += 1
        else:
            status = "offline"
            offline_count += 1

        item["status"] = status
        item["isCurrentInstance"] = (item.get("instanceId") == current_id)

        mem = item.get("memoryMb")
        if isinstance(mem, (int, float)):
            total_mem += mem

        reqs = item.get("requestCount")
        if isinstance(reqs, int):
            total_reqs += reqs

        enriched_instances.append(item)

    # Đưa current instance lên đầu hoặc sắp xếp theo online -> degraded -> offline
    status_order = {"online": 0, "degraded": 1, "offline": 2}
    enriched_instances.sort(key=lambda x: (
        0 if x.get("isCurrentInstance") else 1,
        status_order.get(x.get("status"), 3),
        x.get("name", "")
    ))

    # Đánh giá trạng thái sức khỏe toàn cụm
    if online_count == 0:
        cluster_health = "critical"
    elif degraded_count > 0 or offline_count > 0:
        cluster_health = "warning"
    else:
        cluster_health = "healthy"

    return {
        "clusterName": data.get("clusterName") or "No Hoa Tha Binh Production Cluster",
        "updatedAt": data.get("updatedAt"),
        "loadBalancer": data.get("loadBalancer") or {},
        "heartbeatIntervalSeconds": data.get("heartbeatIntervalSeconds") or 30,
        "staleTimeoutSeconds": stale_timeout,
        "autoPruneDays": data.get("autoPruneDays") or 7,
        "currentInstanceId": current_id,
        "currentInstanceName": get_current_instance_name(),
        "stats": {
            "totalInstances": len(enriched_instances),
            "onlineInstances": online_count,
            "degradedInstances": degraded_count,
            "offlineInstances": offline_count,
            "clusterHealth": cluster_health,
            "totalMemoryMb": round(total_mem, 1),
            "totalRequests": total_reqs
        },
        "instances": enriched_instances
    }


def register_external_instance(payload: Dict[str, Any]) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Cho phép các node/instance bên ngoài gửi heartbeat cập nhật vào cấu hình cụm."""
    if not isinstance(payload, dict):
        return False, None, "Dữ liệu instance không hợp lệ"

    instance_id = (payload.get("instanceId") or "").strip()
    if not instance_id:
        return False, None, "Thiếu trường instanceId bắt buộc"

    now_ts = time.time()
    now_dt = datetime.now(timezone.utc)
    now_iso = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    now_date = now_dt.strftime("%Y-%m-%d")

    data = read_monitor_file()
    instances: List[Dict[str, Any]] = list(data.get("instances") or [])

    merged = {
        "instanceId": instance_id,
        "name": (payload.get("name") or f"Node-{instance_id}").strip(),
        "role": (payload.get("role") or "web-worker").strip(),
        "host": (payload.get("host") or "").strip(),
        "port": int(payload.get("port") or 5000),
        "pid": payload.get("pid"),
        "status": "online",
        "startTime": payload.get("startTime") or now_iso,
        "uptimeSeconds": int(payload.get("uptimeSeconds") or 0),
        "updatedAt": now_iso,
        "updatedDate": now_date,
        "lastHeartbeat": now_iso,
        "lastHeartbeatTimestamp": now_ts,
        "version": payload.get("version") or "v1.2.0",
        "os": payload.get("os") or "Unknown OS",
        "pythonVersion": payload.get("pythonVersion") or "",
        "memoryMb": payload.get("memoryMb"),
        "requestCount": int(payload.get("requestCount") or 0),
        "notes": payload.get("notes") or ""
    }

    found = False
    for i, inst in enumerate(instances):
        if inst.get("instanceId") == instance_id:
            instances[i] = merged
            found = True
            break

    if not found:
        instances.append(merged)

    data["instances"] = instances
    data["updatedAt"] = now_iso
    write_monitor_file(data)
    return True, merged, None


def delete_instance(instance_id: str) -> Tuple[bool, Optional[str]]:
    """Gỡ bỏ một instance khỏi danh sách cụm."""
    clean_id = (instance_id or "").strip()
    if not clean_id:
        return False, "Thiếu instance_id"

    data = read_monitor_file()
    instances = list(data.get("instances") or [])
    new_instances = [inst for inst in instances if inst.get("instanceId") != clean_id]

    if len(new_instances) == len(instances):
        return False, f"Không tìm thấy instance có ID '{clean_id}'"

    data["instances"] = new_instances
    data["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    write_monitor_file(data)
    return True, None


def prune_offline_instances() -> Tuple[int, Optional[str]]:
    """Xóa tất cả các node đang ở trạng thái offline ra khỏi danh sách."""
    data = read_monitor_file()
    now_ts = time.time()
    stale_timeout = int(data.get("staleTimeoutSeconds") or 90)
    current_id = get_current_instance_id()

    instances = list(data.get("instances") or [])
    kept: List[Dict[str, Any]] = []
    pruned_count = 0

    for inst in instances:
        if inst.get("instanceId") == current_id:
            kept.append(inst)
            continue

        last_ts = inst.get("lastHeartbeatTimestamp") or 0
        age = now_ts - last_ts
        if age > (stale_timeout * 3):
            pruned_count += 1
        else:
            kept.append(inst)

    if pruned_count > 0:
        data["instances"] = kept
        data["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        write_monitor_file(data)

    return pruned_count, None


def update_cluster_settings(settings: Dict[str, Any]) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
    """Cập nhật cấu hình chung của Cụm & Load Balancer."""
    if not isinstance(settings, dict):
        return False, None, "Dữ liệu cấu hình cụm không hợp lệ"

    data = read_monitor_file()
    if "clusterName" in settings and isinstance(settings["clusterName"], str):
        data["clusterName"] = settings["clusterName"].strip() or data["clusterName"]

    if "heartbeatIntervalSeconds" in settings:
        try:
            data["heartbeatIntervalSeconds"] = max(5, int(settings["heartbeatIntervalSeconds"]))
        except Exception:
            pass

    if "staleTimeoutSeconds" in settings:
        try:
            data["staleTimeoutSeconds"] = max(10, int(settings["staleTimeoutSeconds"]))
        except Exception:
            pass

    if "autoPruneDays" in settings:
        try:
            data["autoPruneDays"] = max(1, min(365, int(settings["autoPruneDays"])))
        except Exception:
            pass

    lb_in = settings.get("loadBalancer")
    if isinstance(lb_in, dict):
        lb_curr = data.get("loadBalancer") or {}
        if "enabled" in lb_in:
            lb_curr["enabled"] = bool(lb_in["enabled"])
        if "provider" in lb_in:
            lb_curr["provider"] = str(lb_in["provider"]).strip()
        if "algorithm" in lb_in:
            lb_curr["algorithm"] = str(lb_in["algorithm"]).strip()
        if "notes" in lb_in:
            lb_curr["notes"] = str(lb_in["notes"]).strip()
        data["loadBalancer"] = lb_curr

    data["updatedAt"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if write_monitor_file(data):
        return True, data, None
    return False, None, "Không thể ghi tệp instancesMonitor.json"

