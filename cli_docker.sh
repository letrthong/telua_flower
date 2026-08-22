#!/bin/bash

# Configuration variables
CONTAINER_NAME="telua_python_flower"

# Function to show usage information
show_usage() {
    echo "Usage: $0 [action] [options]"
    echo ""
    echo "Actions:"
    echo "  start         Build images and start containers"
    echo "  stop          Stop and remove running containers"
    echo "  restart       Stop and start containers without rebuilding"
    echo "  access        Access the web service container's shell (bash)"
    echo "  run_unittest  Run backend Python unit tests inside the container"
    echo "  js_unittest   Run frontend JS unit tests inside the container"
    echo "  help          Show this help message"
    echo ""
    echo "Options:"
    echo "  --no-cache    Build images without using cache (applies to 'start')"
    echo ""
    echo "Examples:"
    echo "  $0 start                  Build (with cache) and start containers"
    echo "  $0 start --no-cache       Build (without cache) and start containers"
    echo "  $0 --no-cache             Shortcut to build (without cache) and start"
    echo "  $0 stop                   Stop running containers"
    echo "  $0 access                 Access container bash terminal"
    echo "  $0 run_unittest           Run backend Python tests inside container"
    echo "  $0 js_unittest            Run frontend JS tests inside container"
    echo ""
    echo "If no action is provided, the help menu will be displayed."
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

# Determine the action and options
ACTION=""
BUILD_CACHE="true"

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --no-cache)
            BUILD_CACHE="false"
            ;;
        start|stop|restart|access|run_unittest|js_unittest|help|--help|-h)
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
        echo "--> Stopping existing containers..."
        docker compose down
        if [ "$BUILD_CACHE" = "false" ]; then
            echo "--> Building images with --no-cache..."
            docker compose build --no-cache
        else
            echo "--> Building images (using cache)..."
            docker compose build
        fi
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
        docker compose down
        ;;
    restart)
        echo "--> Stopping existing containers..."
        docker compose down
        echo "--> Starting containers..."
        docker compose up
        ;;
    access)
        check_container_running
        echo "--> Accessing container ($CONTAINER_NAME)..."
        docker exec -it "$CONTAINER_NAME" bash
        ;;
    run_unittest)
        check_container_running
        echo "--> Running unit tests inside container ($CONTAINER_NAME)..."
        docker exec -it "$CONTAINER_NAME" env PYTHONPATH=src python -m unittest discover -s src/unittest
        ;;
    js_unittest)
        check_container_running
        echo "--> Running JS unit tests inside container ($CONTAINER_NAME)..."
        docker exec -it "$CONTAINER_NAME" node --test --test-reporter=spec js/unittest
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
