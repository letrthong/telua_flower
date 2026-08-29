#!/bin/bash

# Configuration variables
CONTAINER_NAME="telua_python_flower"
PRIMARY_RECORD_FILE="/opt/.telua_docker_last_clean"
FALLBACK_RECORD_FILE=".docker_last_clean"
CLEAN_INTERVAL_DAYS=30

# Function to show usage information
show_usage() {
    echo "Usage: $0 [action] [options]"
    echo ""
    echo "Actions:"
    echo "  start         Auto-check 30-day deep clean, build images & start containers"
    echo "  stop          Stop containers and clean unused volumes/images"
    echo "  restart       Stop and start containers without rebuilding"
    echo "  clean         Deep clean containers, images, volumes, and build cache (runs every 30 days)"
    echo "  access        Access the web service container's shell (bash)"
    echo "  run_unittest  Run backend Python unit tests inside the container"
    echo "  js_unittest   Run frontend JS unit tests inside the container"
    echo "  test_all      Run BOTH JavaScript and Python unit tests inside the container"
    echo "  help          Show this help message"
    echo ""
    echo "Options:"
    echo "  --no-cache    Build images without using cache (applies to 'start')"
    echo "  --force, -f   Force deep clean immediately, bypassing 30-day wait (applies to 'clean')"
    echo ""
    echo "Examples:"
    echo "  $0 start                  Auto-verify 30-day deep clean, build & start containers"
    echo "  $0 start --no-cache       Auto-verify 30-day clean, build (without cache) & start"
    echo "  $0 --no-cache             Shortcut to build (without cache) and start"
    echo "  $0 stop                   Stop running containers & auto-cleanup"
    echo "  $0 clean                  Check 30-day interval & execute deep clean if due"
    echo "  $0 clean --force          Force immediate deep clean and reset 30-day timer"
    echo "  $0 access                 Access container bash terminal"
    echo "  $0 run_unittest           Run backend Python tests inside container"
    echo "  $0 js_unittest            Run frontend JS tests inside container"
    echo "  $0 test_all               Run 100% full test suites (JS + Python) inside container"
    echo ""
    echo "If no action is provided, the help menu will be displayed."
}

# Function to get existing or writable record file path (prefers /opt)
get_record_file() {
    if [ -f "$PRIMARY_RECORD_FILE" ]; then
        echo "$PRIMARY_RECORD_FILE"
        return
    elif [ -f "$FALLBACK_RECORD_FILE" ]; then
        echo "$FALLBACK_RECORD_FILE"
        return
    fi

    # Try creating / writing to /opt
    if touch "$PRIMARY_RECORD_FILE" 2>/dev/null; then
        echo "$PRIMARY_RECORD_FILE"
    else
        echo "$FALLBACK_RECORD_FILE"
    fi
}

# Function to save cleanup timestamp
save_record_timestamp() {
    local TARGET_FILE
    TARGET_FILE=$(get_record_file)
    local CURRENT_EPOCH
    CURRENT_EPOCH=$(date +%s)
    local CURRENT_DATE
    CURRENT_DATE=$(date "+%Y-%m-%d %H:%M:%S")

    if ! echo "$CURRENT_EPOCH" > "$TARGET_FILE" 2>/dev/null; then
        TARGET_FILE="$FALLBACK_RECORD_FILE"
        echo "$CURRENT_EPOCH" > "$TARGET_FILE"
    fi
    echo "$CURRENT_DATE" >> "$TARGET_FILE"
    echo "--> Recorded cleanup timestamp: $CURRENT_DATE"
    echo "--> Tracking file stored at: $TARGET_FILE"
}

# Function to check if container is running
check_container_running() {
    # Check if Docker daemon is running
    if ! docker info > /dev/null 2>&1; then
        echo "Error: Docker daemon is not running or not accessible."
        echo "Please make sure the Docker service is started."
        exit 1
    fi

    if [ ! "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "Error: Container '$CONTAINER_NAME' is not running."
        echo "Please start the containers first using: $0 start"
        exit 1
    fi
}

# Function to auto-clean dangling images and unused volumes
auto_cleanup() {
    echo "--> Auto-cleaning dangling images & unused volumes..."
    docker image prune -f > /dev/null 2>&1 || true
    docker volume prune -f > /dev/null 2>&1 || true
}

# Function to perform full Docker deep clean
perform_docker_clean() {
    echo "=========================================================="
    echo "--> Starting Full Docker Deep Cleanup..."
    echo "=========================================================="

    # 1. Stop all containers
    local ALL_CONTAINERS
    ALL_CONTAINERS=$(docker ps -a -q)
    if [ -n "$ALL_CONTAINERS" ]; then
        echo "--> [1/5] Stopping all containers..."
        docker stop $ALL_CONTAINERS 2>/dev/null || true

        # 2. Remove all containers
        echo "--> [2/5] Removing all containers..."
        docker rm -f $ALL_CONTAINERS 2>/dev/null || true
    else
        echo "--> [1/5 & 2/5] No containers to stop or remove."
    fi

    echo "--> Pruning stopped containers..."
    docker container prune -f > /dev/null 2>&1 || true

    # 3. Remove all unused and dangling images
    echo "--> [3/5] Removing all unused images to free disk space..."
    docker image prune -a -f

    # 4. Remove build cache & unused volumes
    echo "--> [4/5] Pruning builder cache and volumes..."
    docker volume prune -f > /dev/null 2>&1 || true
    docker builder prune -a -f > /dev/null 2>&1 || docker builder prune -f > /dev/null 2>&1 || true

    # 5. Free system space
    echo "--> [5/5] Freeing Docker system space (system prune)..."
    docker system prune -a --volumes -f

    # Save timestamp to /opt or fallback
    save_record_timestamp

    echo "=========================================================="
    echo "--> Docker deep cleanup completed successfully!"
    echo "--> Next automated cleanup scheduled after $CLEAN_INTERVAL_DAYS days."
    echo "=========================================================="
}

# Function to check 30-day interval before running clean
check_and_run_clean() {
    local MODE="${1:-manual}"
    local CURRENT_EPOCH
    CURRENT_EPOCH=$(date +%s)
    local RECORD_FILE
    RECORD_FILE=$(get_record_file)

    if [ "$FORCE_CLEAN" = "true" ]; then
        echo "--> Force clean option provided (--force / -f)."
        perform_docker_clean
        return 0
    fi

    if [ -f "$RECORD_FILE" ] && [ -s "$RECORD_FILE" ]; then
        local LAST_EPOCH
        LAST_EPOCH=$(head -n 1 "$RECORD_FILE" | tr -d ' \r\n')
        local LAST_DATE_STR
        LAST_DATE_STR=$(sed -n '2p' "$RECORD_FILE" | tr -d '\r\n')

        if [[ "$LAST_EPOCH" =~ ^[0-9]+$ ]]; then
            local ELAPSED_SECONDS=$(( CURRENT_EPOCH - LAST_EPOCH ))
            local ELAPSED_DAYS=$(( ELAPSED_SECONDS / 86400 ))
            local REMAINING_DAYS=$(( CLEAN_INTERVAL_DAYS - ELAPSED_DAYS ))

            if [ "$ELAPSED_DAYS" -lt "$CLEAN_INTERVAL_DAYS" ]; then
                echo "--> [30-Day Check] Last deep clean was on: ${LAST_DATE_STR:-$LAST_EPOCH} ($ELAPSED_DAYS day(s) ago)."
                echo "--> [30-Day Check] Next automated deep clean is in $REMAINING_DAYS day(s) (Interval: $CLEAN_INTERVAL_DAYS days)."
                if [ "$MODE" = "manual" ]; then
                    echo "--> To force clean immediately, run: $0 clean --force (or -f)"
                fi
                return 0
            else
                echo "--> [30-Day Check] $ELAPSED_DAYS day(s) have passed since last clean (${LAST_DATE_STR:-$LAST_EPOCH})."
                echo "--> Threshold of $CLEAN_INTERVAL_DAYS days exceeded. Executing scheduled deep clean..."
                perform_docker_clean
                return 0
            fi
        fi
    fi

    if [ "$MODE" = "auto_start" ]; then
        echo "--> [30-Day Check] Initializing 30-day cleanup tracking..."
        save_record_timestamp
    else
        echo "--> No prior cleanup record found. Executing initial deep clean..."
        perform_docker_clean
    fi
}

# Determine the action and options
ACTION=""
BUILD_CACHE="true"
FORCE_CLEAN="false"

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --no-cache)
            BUILD_CACHE="false"
            ;;
        --force|-f)
            FORCE_CLEAN="true"
            ;;
        start|stop|restart|clean|access|run_unittest|js_unittest|help|--help|-h)
            ACTION="$arg"
            ;;
    esac
done

# Default behavior when no action is provided
if [ -z "$ACTION" ]; then
    if [ "$BUILD_CACHE" = "false" ]; then
        ACTION="start"
    else
        ACTION="help"
    fi
fi

case "$ACTION" in
    start)
        echo "--> Verifying 30-day deep cleanup status..."
        check_and_run_clean "auto_start"

        echo "--> Stopping existing containers & clearing stale volumes..."
        docker compose down -v
        if [ "$BUILD_CACHE" = "false" ]; then
            echo "--> Building images with --no-cache..."
            docker compose build --no-cache
        else
            echo "--> Building images (using cache)..."
            docker compose build
        fi

        # Tự động dọn dẹp dangling images & volumes cũ ngay sau khi build
        auto_cleanup

        echo "--> Starting containers..."
        docker compose up -d
        
        echo "--> Waiting for container to start..."
        sleep 3
        
        echo "--> Copying built index.html from container to host..."
        docker cp telua_python_flower:/app/dist/index.html ./config/index.html || echo "Warning: Failed to copy index.html from container"
        
        echo "--> Attaching to container logs..."
        docker compose logs -f
        ;;
    stop)
        echo "--> Stopping containers..."
        docker compose down -v
        auto_cleanup
        echo "--> Containers stopped and unused artifacts cleaned."
        ;;
    restart)
        echo "--> Stopping existing containers..."
        docker compose down
        echo "--> Starting containers..."
        docker compose up
        ;;
    clean)
        check_and_run_clean "manual"
        ;;
    access)
        check_container_running
        echo "--> Accessing container ($CONTAINER_NAME)..."
        docker exec -it "$CONTAINER_NAME" bash
        ;;
    run_unittest)
        check_container_running
        echo "--> Running unit tests inside container ($CONTAINER_NAME)..."
        docker exec -it "$CONTAINER_NAME" env PYTHONPATH=src python -m unittest discover -s src/unittest -p "test_*.py"
        ;;
    js_unittest)
        check_container_running
        echo "--> Running JS unit tests inside container ($CONTAINER_NAME)..."
        docker exec -it "$CONTAINER_NAME" node --test js/unittest/*.js
        ;;
    test_all)
        check_container_running
        echo "=========================================="
        echo "--> 1. Running JavaScript Unit Tests..."
        echo "=========================================="
        docker exec -it "$CONTAINER_NAME" node --test js/unittest/*.js
        echo ""
        echo "=========================================="
        echo "--> 2. Running Python Unit Tests..."
        echo "=========================================="
        docker exec -it "$CONTAINER_NAME" env PYTHONPATH=src python -m unittest discover -s src/unittest -p "test_*.py"
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo "Error: Unknown action '$ACTION'"
        show_usage
        exit 1
        ;;
esac


