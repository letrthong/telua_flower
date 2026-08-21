# Docker Deployment & Build Guide on Ubuntu (`telua_flower`)

This document provides a comprehensive step-by-step guide to building, deploying, and testing the **Nở Hoa Thả Bình (`telua_flower`)** application directly on an **Ubuntu Linux** environment using the provided `cli_docker.sh` management script.

> [!TIP]
> All build and runtime dependencies (Python environment, Node.js/npm, Vite frontend bundle generation, and Flask backend server) are completely automated inside Docker containers. **You do not need to install Node.js or Python on Windows or on the host machine.**

---

## 1. Prerequisites on Ubuntu

Before proceeding, ensure your Ubuntu server or virtual machine has the following tools installed:
- **Git** (to clone or sync repository files).
- **Docker Engine** (version 20.10+ or newer).
- **Docker Compose** (V2 plugin integrated via `docker compose`).

### Quick Docker Installation on Ubuntu:
```bash
# 1. Update package list & install required tools
sudo apt update && sudo apt install -y curl git

# 2. Install Docker using official automated script
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 3. Enable non-root user execution for Docker
sudo usermod -aG docker $USER
newgrp docker
```

---

## 2. Step-by-Step Deployment Guide

### Step 1: Clone or Sync the Project
```bash
# Navigate to your workspace and clone the repository
git clone <URL_REPO_TELUA_FLOWER> telua_flower
cd telua_flower
```

### Step 2: Grant Execute Permissions
Make sure the CLI script has execute permissions:
```bash
chmod +x cli_docker.sh
```

*(Recommended: If the repository was edited on or copied from Windows, normalize line endings to Unix format (`LF`):)*
```bash
sed -i 's/\r$//' cli_docker.sh
```

### Step 3: Build & Start the Container
Run the automated start command:
```bash
./cli_docker.sh start
```

If you want to **force a fresh build without using Docker layer caching**:
```bash
./cli_docker.sh start --no-cache
```

---

## 3. Command Reference (`cli_docker.sh`)

The [cli_docker.sh](file:///d:/code/telua_flower/cli_docker.sh) script provides convenient commands to control and manage the container lifecycle:

| Command | Description |
| :--- | :--- |
| `./cli_docker.sh start` | Stops existing containers, builds the Docker image (with cache), starts services in background, and streams logs |
| `./cli_docker.sh start --no-cache` | Rebuilds the Docker image completely from scratch without cache, then starts the service |
| `./cli_docker.sh stop` | Gracefully stops and removes the running containers |
| `./cli_docker.sh restart` | Restarts existing containers quickly without rebuilding |
| `./cli_docker.sh access` | Opens an interactive bash terminal inside the `telua_python_flower` container |
| `./cli_docker.sh run_unittest` | Executes the backend Python test suite inside the container |
| `./cli_docker.sh js_unittest` | Executes frontend JavaScript tests inside the container |
| `./cli_docker.sh help` | Displays the command-line usage and help menu |

---

## 4. Verifying & Accessing the Application

Once the container has successfully started:

1. **Access via Web Browser:**
   - On a local Ubuntu desktop: Open `http://localhost:5000`
   - On an Ubuntu remote server: Open `http://<UBUNTU_SERVER_IP>:5000`

2. **Verify Container Status:**
   ```bash
   docker ps
   ```
   You should see container `telua_python_flower` running with port mapping `0.0.0.0:5000->5000/tcp`.

3. **Stream Container Logs:**
   ```bash
   docker compose logs -f
   ```

---

## 5. Running Automated Tests on Ubuntu

You do not need to install Python or test runners locally on the Ubuntu host. Run tests directly inside the Docker container:

```bash
# Run backend Python unit tests
./cli_docker.sh run_unittest
```

---

## 6. Troubleshooting & FAQs

### 1. Error: `\r: command not found` when executing `cli_docker.sh`
- **Cause:** Windows `CRLF` line endings are present in the script.
- **Solution:**
  ```bash
  sed -i 's/\r$//' cli_docker.sh
  ```

### 2. Error: `permission denied while trying to connect to the Docker daemon socket`
- **Cause:** Current user is not in the `docker` usergroup.
- **Solution:**
  ```bash
  sudo usermod -aG docker $USER
  newgrp docker
  ```

### 3. Port 5000 conflict with existing service
- **Cause:** Another process on Ubuntu is already using port 5000.
- **Solution:** Open [docker-compose.yml](file:///d:/code/telua_flower/docker-compose.yml) and change the host port mapping (e.g. `8080:5000`):
  ```yaml
  ports:
    - "8080:5000"
  ```
  Then restart with `./cli_docker.sh restart`.
