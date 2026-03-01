#!/bin/bash

# Maestro Test Runner Script
# This script helps run Maestro tests with common configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
PLATFORM="both"
TAG=""
FLOW=""
DEVICE=""
ENV_FILE=".maestro/.env"

# Function to print colored output
print_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if Maestro is installed
check_maestro() {
    if ! command -v maestro &> /dev/null; then
        print_error "Maestro is not installed!"
        echo "Install it with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
        exit 1
    fi
    print_info "Maestro version: $(maestro --version)"
}

# Function to check if env file exists
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning ".env file not found. Creating from example..."
        if [ -f ".maestro/.env.example" ]; then
            cp .maestro/.env.example "$ENV_FILE"
            print_warning "Please update $ENV_FILE with your app details"
            exit 1
        else
            print_error ".env.example not found!"
            exit 1
        fi
    fi
}

# Function to list available flows
list_flows() {
    print_info "Available test flows:"
    ls -1 .maestro/flows/*.yaml | sed 's|.maestro/flows/||' | sed 's|.yaml||'
}

# Function to run tests
run_tests() {
    local cmd="maestro test"
    
    # Add environment file
    if [ -f "$ENV_FILE" ]; then
        cmd="$cmd --env $ENV_FILE"
    fi
    
    # Add platform filter
    if [ "$PLATFORM" != "both" ]; then
        cmd="$cmd --platform $PLATFORM"
    fi
    
    # Add tag filter
    if [ -n "$TAG" ]; then
        cmd="$cmd --tag $TAG"
    fi
    
    # Add device filter
    if [ -n "$DEVICE" ]; then
        cmd="$cmd --device \"$DEVICE\""
    fi
    
    # Add flow path
    if [ -n "$FLOW" ]; then
        cmd="$cmd .maestro/flows/$FLOW.yaml"
    else
        cmd="$cmd .maestro/flows"
    fi
    
    print_info "Running: $cmd"
    eval $cmd
}

# Function to show usage
usage() {
    cat << EOF
Usage: ./run-maestro-tests.sh [OPTIONS]

Options:
    -p, --platform <ios|android|both>  Platform to test (default: both)
    -t, --tag <tag>                    Run tests with specific tag
    -f, --flow <flow-name>             Run specific flow (without .yaml extension)
    -d, --device <device-name>         Run on specific device
    -l, --list                         List all available flows
    -s, --studio                       Open Maestro Studio for interactive testing
    -h, --help                         Show this help message

Examples:
    # Run all tests
    ./run-maestro-tests.sh

    # Run only iOS tests
    ./run-maestro-tests.sh --platform ios

    # Run tests tagged as 'smoke'
    ./run-maestro-tests.sh --tag smoke

    # Run specific flow
    ./run-maestro-tests.sh --flow 01-app-launch

    # Run on specific device
    ./run-maestro-tests.sh --device "iPhone 15 Pro"

    # List all flows
    ./run-maestro-tests.sh --list

    # Open Studio
    ./run-maestro-tests.sh --studio

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--platform)
            PLATFORM="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -f|--flow)
            FLOW="$2"
            shift 2
            ;;
        -d|--device)
            DEVICE="$2"
            shift 2
            ;;
        -l|--list)
            list_flows
            exit 0
            ;;
        -s|--studio)
            print_info "Opening Maestro Studio..."
            maestro studio
            exit 0
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Main execution
print_info "Starting Maestro Test Runner..."
check_maestro
check_env
run_tests

print_info "Tests completed!"
