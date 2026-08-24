import unittest
import os

class TestFileStructure(unittest.TestCase):
    def test_main_files_exist(self):
        """Kiểm tra các file cốt lõi của dự án tồn tại"""
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        
        # 1. Kiểm tra file index.html
        self.assertTrue(os.path.exists(os.path.join(root_dir, "index.html")))
        
        # 2. Kiểm tra file cấu hình
        self.assertTrue(os.path.exists(os.path.join(root_dir, "requirements.txt")))
        self.assertTrue(os.path.exists(os.path.join(root_dir, "README.md")))
        
        # 3. Kiểm tra thư mục js và src
        self.assertTrue(os.path.isdir(os.path.join(root_dir, "js")))
        self.assertTrue(os.path.isdir(os.path.join(root_dir, "src")))

if __name__ == '__main__':
    unittest.main()
