#!/bin/bash

# Testing Environment Setup Verification Script
# Checks if all testing tools are properly installed and configured

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

check_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

check_fail() {
    echo -e "${RED}✗ $1${NC}"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
    ((WARNINGS++))
}

# Check Node.js
print_header "Checking Node.js"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    check_pass "Node.js installed: $NODE_VERSION"
    
    # Check if version is >= 16
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 16 ]; then
        check_pass "Node.js version is compatible (>= 16)"
    else
        check_warn "Node.js version should be >= 16, current: $NODE_VERSION"
    fi
else
    check_fail "Node.js is not installed"
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    check_pass "npm installed: v$NPM_VERSION"
else
    check_fail "npm is not installed"
fi

# Check package.json
if [ -f "package.json" ]; then
    check_pass "package.json exists"
    
    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        check_pass "node_modules directory exists"
    else
        check_warn "node_modules not found. Run 'npm install'"
    fi
else
    check_fail "package.json not found"
fi

# Check Jest
print_header "Checking Jest"
if npm list jest &> /dev/null; then
    JEST_VERSION=$(npm list jest | grep jest@ | head -1 | sed 's/.*jest@//' | sed 's/ .*//')
    check_pass "Jest installed: v$JEST_VERSION"
else
    check_warn "Jest not found in package.json"
fi

# Check React Native Testing Library
if npm list @testing-library/react-native &> /dev/null; then
    RNTL_VERSION=$(npm list @testing-library/react-native | grep @testing-library/react-native@ | head -1 | sed 's/.*@testing-library\/react-native@//' | sed 's/ .*//')
    check_pass "React Native Testing Library installed: v$RNTL_VERSION"
else
    check_warn "React Native Testing Library not found"
fi

# Check Detox
print_header "Checking Detox"
if command -v detox &> /dev/null; then
    DETOX_VERSION=$(detox --version 2>&1 | head -1)
    check_pass "Detox CLI installed: $DETOX_VERSION"
else
    check_warn "Detox CLI not installed. Install with: npm install -g detox-cli"
fi

if npm list detox &> /dev/null; then
    check_pass "Detox package installed"
else
    check_warn "Detox package not found in package.json"
fi

# Check Maestro
print_header "Checking Maestro"
if command -v maestro &> /dev/null; then
    MAESTRO_VERSION=$(maestro --version 2>&1)
    check_pass "Maestro installed: $MAESTRO_VERSION"
    
    # Check if .maestro directory exists
    if [ -d ".maestro" ]; then
        check_pass ".maestro directory exists"
        
        # Check for flows
        if [ -d ".maestro/flows" ] && [ "$(ls -A .maestro/flows)" ]; then
            FLOW_COUNT=$(ls -1 .maestro/flows/*.yaml 2>/dev/null | wc -l)
            check_pass "Maestro flows found: $FLOW_COUNT"
        else
            check_warn ".maestro/flows directory is empty"
        fi
        
        # Check for .env file
        if [ -f ".maestro/.env" ]; then
            check_pass ".maestro/.env file exists"
        else
            check_warn ".maestro/.env not found. Copy from .env.example"
        fi
    else
        check_warn ".maestro directory not found"
    fi
else
    check_warn "Maestro not installed. Install with: curl -Ls \"https://get.maestro.mobile.dev\" | bash"
fi

# Check iOS Development Tools (macOS only)
if [[ "$OSTYPE" == "darwin"* ]]; then
    print_header "Checking iOS Development Tools"
    
    if command -v xcodebuild &> /dev/null; then
        XCODE_VERSION=$(xcodebuild -version | head -1)
        check_pass "Xcode installed: $XCODE_VERSION"
    else
        check_warn "Xcode not installed"
    fi
    
    if command -v pod &> /dev/null; then
        POD_VERSION=$(pod --version)
        check_pass "CocoaPods installed: v$POD_VERSION"
    else
        check_warn "CocoaPods not installed. Install with: sudo gem install cocoapods"
    fi
    
    # Check for iOS simulators
    if command -v xcrun &> /dev/null; then
        SIM_COUNT=$(xcrun simctl list devices available | grep -c "iPhone" || true)
        if [ "$SIM_COUNT" -gt 0 ]; then
            check_pass "iOS Simulators available: $SIM_COUNT"
        else
            check_warn "No iOS simulators found"
        fi
    fi
fi

# Check Android Development Tools
print_header "Checking Android Development Tools"

if [ -n "$ANDROID_HOME" ] || [ -n "$ANDROID_SDK_ROOT" ]; then
    ANDROID_HOME=${ANDROID_HOME:-$ANDROID_SDK_ROOT}
    check_pass "Android SDK found: $ANDROID_HOME"
    
    if command -v adb &> /dev/null; then
        ADB_VERSION=$(adb --version | head -1)
        check_pass "ADB installed: $ADB_VERSION"
    else
        check_warn "ADB not found in PATH"
    fi
    
    if command -v emulator &> /dev/null; then
        check_pass "Android Emulator available"
    else
        check_warn "Android Emulator not found in PATH"
    fi
else
    check_warn "ANDROID_HOME or ANDROID_SDK_ROOT not set"
fi

if [ -n "$JAVA_HOME" ]; then
    check_pass "JAVA_HOME set: $JAVA_HOME"
    
    if command -v java &> /dev/null; then
        JAVA_VERSION=$(java -version 2>&1 | head -1)
        check_pass "Java installed: $JAVA_VERSION"
    fi
else
    check_warn "JAVA_HOME not set"
fi

# Check Git
print_header "Checking Version Control"
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    check_pass "$GIT_VERSION"
else
    check_warn "Git not installed"
fi

# Check test scripts
print_header "Checking Test Scripts"

if [ -f "run-maestro-tests.sh" ]; then
    check_pass "run-maestro-tests.sh exists"
    if [ -x "run-maestro-tests.sh" ]; then
        check_pass "run-maestro-tests.sh is executable"
    else
        check_warn "run-maestro-tests.sh is not executable. Run: chmod +x run-maestro-tests.sh"
    fi
else
    check_warn "run-maestro-tests.sh not found"
fi

if [ -f "run-all-tests.sh" ]; then
    check_pass "run-all-tests.sh exists"
    if [ -x "run-all-tests.sh" ]; then
        check_pass "run-all-tests.sh is executable"
    else
        check_warn "run-all-tests.sh is not executable. Run: chmod +x run-all-tests.sh"
    fi
else
    check_warn "run-all-tests.sh not found"
fi

# Summary
print_header "Summary"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Your testing environment is fully configured.${NC}"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Setup complete with $WARNINGS warning(s).${NC}"
    echo -e "${YELLOW}  Review warnings above to ensure full functionality.${NC}"
    exit 0
else
    echo -e "${RED}✗ Setup incomplete: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo -e "${RED}  Please fix the errors above before running tests.${NC}"
    exit 1
fi
