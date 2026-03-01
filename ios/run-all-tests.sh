#!/bin/bash

# Comprehensive Test Suite Runner
# Runs Jest, React Native Testing Library, Detox, and Maestro tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
JEST_PASSED=false
DETOX_PASSED=false
MAESTRO_PASSED=false

# Function to print colored output
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_info() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to run Jest tests
run_jest() {
    print_header "Running Jest Unit Tests"
    
    if npm run test -- --ci --coverage --maxWorkers=2; then
        JEST_PASSED=true
        print_info "Jest tests passed"
    else
        print_error "Jest tests failed"
    fi
}

# Function to run Detox tests
run_detox() {
    print_header "Running Detox E2E Tests"
    
    # Build the app if needed
    print_info "Building app for Detox..."
    if npm run detox:build:ios 2>/dev/null || npx detox build --configuration ios.sim.debug 2>/dev/null; then
        print_info "Build successful"
    else
        print_warning "Could not build for Detox (build command might not be configured)"
    fi
    
    # Run Detox tests
    if npm run detox:test:ios 2>/dev/null || npx detox test --configuration ios.sim.debug 2>/dev/null; then
        DETOX_PASSED=true
        print_info "Detox tests passed"
    else
        print_error "Detox tests failed or not configured"
    fi
}

# Function to run Maestro tests
run_maestro() {
    print_header "Running Maestro E2E Tests"
    
    # Check if Maestro is installed
    if ! command -v maestro &> /dev/null; then
        print_warning "Maestro is not installed. Skipping Maestro tests."
        print_info "Install with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
        return
    fi
    
    # Check if .env file exists
    if [ ! -f ".maestro/.env" ]; then
        print_warning ".maestro/.env not found. Creating from example..."
        if [ -f ".maestro/.env.example" ]; then
            cp .maestro/.env.example .maestro/.env
            print_warning "Please update .maestro/.env with your app details before running Maestro tests"
            return
        fi
    fi
    
    # Run Maestro tests
    if maestro test --env .maestro/.env .maestro/flows; then
        MAESTRO_PASSED=true
        print_info "Maestro tests passed"
    else
        print_error "Maestro tests failed"
    fi
}

# Function to print summary
print_summary() {
    print_header "Test Summary"
    
    echo "Test Results:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$JEST_PASSED" = true ]; then
        print_info "Jest Unit Tests: PASSED"
    else
        print_error "Jest Unit Tests: FAILED"
    fi
    
    if [ "$DETOX_PASSED" = true ]; then
        print_info "Detox E2E Tests: PASSED"
    else
        print_error "Detox E2E Tests: FAILED"
    fi
    
    if [ "$MAESTRO_PASSED" = true ]; then
        print_info "Maestro E2E Tests: PASSED"
    else
        print_error "Maestro E2E Tests: FAILED"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$JEST_PASSED" = true ] && [ "$DETOX_PASSED" = true ] && [ "$MAESTRO_PASSED" = true ]; then
        print_info "All tests passed! 🎉"
        exit 0
    else
        print_error "Some tests failed. Please review the output above."
        exit 1
    fi
}

# Function to show usage
usage() {
    cat << EOF
Usage: ./run-all-tests.sh [OPTIONS]

Options:
    --jest-only       Run only Jest unit tests
    --detox-only      Run only Detox E2E tests
    --maestro-only    Run only Maestro E2E tests
    --skip-jest       Skip Jest unit tests
    --skip-detox      Skip Detox E2E tests
    --skip-maestro    Skip Maestro E2E tests
    -h, --help        Show this help message

Examples:
    # Run all tests
    ./run-all-tests.sh

    # Run only unit tests
    ./run-all-tests.sh --jest-only

    # Run E2E tests only (Detox and Maestro)
    ./run-all-tests.sh --skip-jest

    # Run only Maestro tests
    ./run-all-tests.sh --maestro-only

EOF
}

# Parse command line arguments
RUN_JEST=true
RUN_DETOX=true
RUN_MAESTRO=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --jest-only)
            RUN_DETOX=false
            RUN_MAESTRO=false
            shift
            ;;
        --detox-only)
            RUN_JEST=false
            RUN_MAESTRO=false
            shift
            ;;
        --maestro-only)
            RUN_JEST=false
            RUN_DETOX=false
            shift
            ;;
        --skip-jest)
            RUN_JEST=false
            shift
            ;;
        --skip-detox)
            RUN_DETOX=false
            shift
            ;;
        --skip-maestro)
            RUN_MAESTRO=false
            shift
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
print_header "Comprehensive Test Suite"
echo "Starting test execution..."

# Run selected tests
if [ "$RUN_JEST" = true ]; then
    run_jest
else
    print_warning "Skipping Jest tests"
    JEST_PASSED=true  # Don't fail if skipped
fi

if [ "$RUN_DETOX" = true ]; then
    run_detox
else
    print_warning "Skipping Detox tests"
    DETOX_PASSED=true  # Don't fail if skipped
fi

if [ "$RUN_MAESTRO" = true ]; then
    run_maestro
else
    print_warning "Skipping Maestro tests"
    MAESTRO_PASSED=true  # Don't fail if skipped
fi

# Print summary
print_summary
