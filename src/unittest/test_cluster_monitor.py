# -*- coding: utf-8 -*-
"""
Unit Test: Hệ Thống Giám Sát Cụm Đa Instance & Load Balancer (Cluster Monitor & Instances Array)
Kiểm tra tệp instancesMonitor.json, tự động đăng ký heartbeat, tính toán sức khỏe cụm,
và các API quản trị phục vụ chạy môi trường cân bằng tải (Load Balancer).
"""

import os
import sys
import json
import time
import unittest
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app import app
from anne_auth_service import generate_jwt_token
from instance_monitor_service import (
    get_cluster_monitor_data,
    heartbeat_current_instance,
    register_external_instance,
    delete_instance,
    prune_offline_instances,
    update_cluster_settings,
    get_current_instance_id,
    get_current_instance_name,
    get_process_memory_mb,
    read_monitor_file,
    write_monitor_file,
    DEFAULT_CLUSTER_MONITOR
)


class TestClusterMonitor(unittest.TestCase):
    def setUp(self):
        self.app = app
        self.client = self.app.test_client()
        self.admin_token = generate_jwt_token({
            "id": "admin_test",
            "username": "admin",
            "role": "super_admin",
            "branchId": "admin"
        })
        self.manager_token = generate_jwt_token({
            "id": "manager_test",
            "username": "manager",
            "role": "branch_manager",
            "branchId": "branch_q1"
        })
        # Reset monitor data sạch cho test
        self.initial_data = read_monitor_file()

    def tearDown(self):
        # Khôi phục dữ liệu ban đầu
        if self.initial_data:
            write_monitor_file(self.initial_data)

    def test_public_healthcheck_endpoint(self):
        """Kiểm tra API /health dành riêng cho Load Balancer (Nginx, AWS ALB, Traefik)"""
        res = self.client.get("/api/flower/v1/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertTrue(data.get("instanceId"))
        self.assertTrue(data.get("timestamp"))

    def test_current_instance_metrics_and_heartbeat(self):
        """Kiểm tra tự thu thập thông tin instance và cập nhật heartbeat"""
        current_id = get_current_instance_id()
        self.assertTrue(current_id)

        metrics = heartbeat_current_instance()
        self.assertEqual(metrics["instanceId"], current_id)
        self.assertEqual(metrics["status"], "online")
        self.assertGreaterEqual(metrics["uptimeSeconds"], 0)
        self.assertTrue(metrics["lastHeartbeat"])

        # Đọc dữ liệu cụm
        cluster_data = get_cluster_monitor_data(auto_heartbeat=False)
        self.assertIn("instances", cluster_data)
        self.assertIn("stats", cluster_data)
        self.assertGreaterEqual(cluster_data["stats"]["totalInstances"], 1)
        self.assertGreaterEqual(cluster_data["stats"]["onlineInstances"], 1)

        # Instance hiện tại phải được đánh dấu isCurrentInstance: True
        matched = [x for x in cluster_data["instances"] if x.get("instanceId") == current_id]
        self.assertTrue(len(matched) > 0)
        self.assertTrue(matched[0]["isCurrentInstance"])

    def test_admin_get_monitor_instances_api(self):
        """Kiểm tra API GET /api/flower/v1/admin/monitor/instances có bảo vệ quyền RBAC"""
        # 1. Không có token -> 401
        res_no_auth = self.client.get("/api/flower/v1/admin/monitor/instances")
        self.assertIn(res_no_auth.status_code, (401, 403))

        # 2. Token quản lý hoặc admin -> 200
        res = self.client.get("/api/flower/v1/admin/monitor/instances", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res.status_code, 200)
        json_data = res.get_json()
        self.assertTrue(json_data["success"])
        data = json_data["data"]
        self.assertIn("instances", data)
        self.assertIn("loadBalancer", data)
        self.assertIn("stats", data)
        self.assertEqual(data["currentInstanceId"], get_current_instance_id())

    def test_external_instance_registration_and_prune(self):
        """
        Kiểm tra mô hình Load Balancer nhiều node:
        Node bên ngoài (ví dụ worker-02 trên container khác) đăng ký và gửi heartbeat.
        Sau đó thử gỡ bỏ hoặc dọn dẹp node cũ.
        """
        ext_node = {
            "instanceId": "node-docker-worker-02",
            "name": "Node Worker 02 (Docker)",
            "role": "web-worker",
            "host": "10.0.1.55",
            "port": 5000,
            "pid": 4321,
            "version": "v1.2.0",
            "os": "Linux 6.8.0-ubuntu",
            "memoryMb": 192.5,
            "requestCount": 540,
            "notes": "Node worker phục vụ mở rộng trong phiên khuyến mãi"
        }

        # 1. Gửi heartbeat node ngoại vi
        res_hb = self.client.post(
            "/api/flower/v1/admin/monitor/heartbeat",
            json=ext_node
        )
        self.assertEqual(res_hb.status_code, 200)
        self.assertTrue(res_hb.get_json()["success"])

        # 2. Kiểm tra node vừa thêm xuất hiện trong danh sách cụm
        res_list = self.client.get("/api/flower/v1/admin/monitor/instances", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        instances = res_list.get_json()["data"]["instances"]
        found = [x for x in instances if x.get("instanceId") == "node-docker-worker-02"]
        self.assertEqual(len(found), 1)
        self.assertEqual(found[0]["name"], "Node Worker 02 (Docker)")
        self.assertEqual(found[0]["host"], "10.0.1.55")

        # 3. Thử xóa node này qua API DELETE /instances/<instance_id>
        res_del = self.client.delete(
            "/api/flower/v1/admin/monitor/instances/node-docker-worker-02",
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        self.assertEqual(res_del.status_code, 200)
        self.assertTrue(res_del.get_json()["success"])

        # 4. Kiểm tra lại -> Node đã bị xóa
        res_after = self.client.get("/api/flower/v1/admin/monitor/instances", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        instances_after = res_after.get_json()["data"]["instances"]
        self.assertFalse(any(x.get("instanceId") == "node-docker-worker-02" for x in instances_after))

    def test_update_cluster_settings(self):
        """Kiểm tra cập nhật thông số Load Balancer và Cụm qua API PUT /admin/monitor/cluster-config"""
        payload = {
            "clusterName": "Cụm Sản Xuất Nở Hoa Thả Bình (HA)",
            "heartbeatIntervalSeconds": 20,
            "staleTimeoutSeconds": 60,
            "loadBalancer": {
                "enabled": True,
                "provider": "AWS Application Load Balancer (ALB)",
                "algorithm": "Least Connections",
                "notes": "Tự động scale từ 2 đến 8 instances"
            }
        }
        res = self.client.put(
            "/api/flower/v1/admin/monitor/cluster-config",
            headers={"Authorization": f"Bearer {self.admin_token}"},
            json=payload
        )
        self.assertEqual(res.status_code, 200)
        res_json = res.get_json()
        self.assertTrue(res_json["success"])

        # Kiểm tra đọc lại
        res_get = self.client.get("/api/flower/v1/admin/monitor/instances", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        data = res_get.get_json()["data"]
        self.assertEqual(data["clusterName"], "Cụm Sản Xuất Nở Hoa Thả Bình (HA)")
        self.assertEqual(data["staleTimeoutSeconds"], 60)
        self.assertEqual(data["loadBalancer"]["provider"], "AWS Application Load Balancer (ALB)")
        self.assertEqual(data["loadBalancer"]["algorithm"], "Least Connections")

    def test_ui_tab_monitor_elements_in_html(self):
        """Kiểm tra giao diện có modal riêng #clusterOpsModal, tab #tabOpsBtnMonitor và nội dung #tabSysContentMonitor trong HTML"""
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        for rel_html in ["index.html", os.path.join("config", "index.html")]:
            html_path = os.path.join(root_dir, rel_html)
            with open(html_path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn('id="clusterOpsModal"', content)
            self.assertIn('id="tabOpsBtnMonitor"', content)
            self.assertIn("switchClusterOpsTab('monitor')", content)
            self.assertIn('id="tabSysContentMonitor"', content)
            self.assertIn('id="adminMonitorInstancesList"', content)
            self.assertIn('id="clusterHealthBadge"', content)
            self.assertIn('id="monStatTotalNodes"', content)
            self.assertIn('id="monStatOnlineNodes"', content)
            self.assertIn('id="monStatCurrentNodeId"', content)
            self.assertIn('id="clusterAutoPruneDaysInput"', content)

    def test_updated_date_and_auto_prune_one_week_old_instances(self):
        """
        Kiểm tra yêu cầu:
        1. Mỗi instance có ngày cập nhật (updatedAt, updatedDate, lastHeartbeat).
        2. Tự động xóa node sau 1 tuần (7 ngày) không cập nhật.
        """
        now = time.time()
        # Chuẩn bị dữ liệu mẫu trực tiếp vào file monitor
        mock_data = {
            "clusterName": "Test Auto Prune Cluster",
            "autoPruneDays": 7,
            "staleTimeoutSeconds": 90,
            "instances": [
                {
                    "instanceId": "node-active-recent",
                    "name": "Node Mới Cập Nhật",
                    "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "updatedDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "lastHeartbeatTimestamp": now - 3600,  # 1 giờ trước
                    "status": "online"
                },
                {
                    "instanceId": "node-medium-3days",
                    "name": "Node 3 Ngày Trước",
                    "updatedAt": "2026-11-01T10:00:00Z",
                    "updatedDate": "2026-11-01",
                    "lastHeartbeatTimestamp": now - (3 * 86400),  # 3 ngày trước
                    "status": "offline"
                },
                {
                    "instanceId": "node-expired-8days",
                    "name": "Node Quá Hạn 8 Ngày (1 Tuần Không Cập Nhật)",
                    "updatedAt": "2026-10-27T10:00:00Z",
                    "updatedDate": "2026-10-27",
                    "lastHeartbeatTimestamp": now - (8 * 86400),  # 8 ngày trước (quá 1 tuần)
                    "status": "offline"
                }
            ]
        }
        write_monitor_file(mock_data)

        # 1. Gọi API lấy dữ liệu giám sát cụm (kích hoạt auto-prune tự động)
        res = self.client.get("/api/flower/v1/admin/monitor/instances", headers={
            "Authorization": f"Bearer {self.admin_token}"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()["data"]
        instances = data["instances"]

        # Node hiện tại (được tự động thêm) phải có updatedAt và updatedDate
        current_id = get_current_instance_id()
        curr_inst = next((x for x in instances if x["instanceId"] == current_id), None)
        self.assertIsNotNone(curr_inst)
        self.assertTrue(curr_inst.get("updatedAt"))
        self.assertTrue(curr_inst.get("updatedDate"))

        # Node 8 ngày trước (node-expired-8days) PHẢI BỊ XÓA BỎ
        self.assertFalse(any(x["instanceId"] == "node-expired-8days" for x in instances),
                         "Node quá 1 tuần (7 ngày) không cập nhật phải tự động bị xóa khỏi mảng!")

        # Node 3 ngày trước và node mới vẫn được giữ lại
        self.assertTrue(any(x["instanceId"] == "node-active-recent" for x in instances))
        self.assertTrue(any(x["instanceId"] == "node-medium-3days" for x in instances))

        # 2. Đọc trực tiếp từ file JSON trên đĩa để xác nhận file đã được cập nhật sạch sẽ
        disk_data = read_monitor_file()
        disk_ids = [x["instanceId"] for x in disk_data["instances"]]
        self.assertNotIn("node-expired-8days", disk_ids)
        self.assertIn("node-active-recent", disk_ids)

    def test_cpu_and_ram_metrics_collection_and_modal_support(self):
        """Kiểm tra thu thập thông số CPU và RAM của instance, cùng sự hiện diện của modal giao diện đẹp."""
        # 1. Gọi heartbeat để thu thập metrics mới nhất
        updated = heartbeat_current_instance()
        self.assertIsNotNone(updated)
        self.assertIn("cpuPercent", updated)
        self.assertIsInstance(updated["cpuPercent"], float)
        self.assertIn("cpuCores", updated)
        self.assertGreaterEqual(updated["cpuCores"], 1)

        # Kiểm tra RAM (memoryMb)
        self.assertIn("memoryMb", updated)
        if updated["memoryMb"] is not None:
            self.assertGreater(updated["memoryMb"], 0)

        # 2. Kiểm tra modal `#clusterInstanceDetailModal` có mặt trong index.html và config/index.html
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        for fn in ("index.html", "config/index.html"):
            path = os.path.join(base_dir, fn)
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            self.assertIn('id="clusterInstanceDetailModal"', content, f"Missing clusterInstanceDetailModal in {fn}")
            self.assertIn('id="instanceDetailCpuValue"', content, f"Missing instanceDetailCpuValue in {fn}")
            self.assertIn('id="instanceDetailRamValue"', content, f"Missing instanceDetailRamValue in {fn}")
            self.assertIn('id="instanceDetailCpuBar"', content, f"Missing instanceDetailCpuBar in {fn}")
            self.assertIn('id="instanceDetailRamBar"', content, f"Missing instanceDetailRamBar in {fn}")
            # Kiểm tra modal tách riêng clusterOpsModal và nút mở
            self.assertIn('id="clusterOpsModal"', content, f"Missing clusterOpsModal in {fn}")
            self.assertIn('onclick="openClusterOpsModal()"', content, f"Missing openClusterOpsModal button in {fn}")
            self.assertIn('id="tabOpsBtnMonitor"', content, f"Missing tabOpsBtnMonitor in {fn}")
            self.assertIn('id="tabOpsBtnNotify"', content, f"Missing tabOpsBtnNotify in {fn}")

        # 3. Kiểm tra bundle.js có chứa openClusterInstanceDetailModal và openClusterOpsModal
        bundle_path = os.path.join(base_dir, "js", "bundle.js")
        with open(bundle_path, "r", encoding="utf-8") as f:
            bundle_content = f.read()
        self.assertIn("openClusterInstanceDetailModal", bundle_content)
        self.assertIn("closeClusterInstanceDetailModal", bundle_content)
        self.assertIn("openClusterOpsModal", bundle_content)
        self.assertIn("closeClusterOpsModal", bundle_content)
        self.assertIn("switchClusterOpsTab", bundle_content)


if __name__ == "__main__":
    unittest.main()
