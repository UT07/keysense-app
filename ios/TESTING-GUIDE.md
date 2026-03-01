# Comprehensive Testing Guide

This project uses a multi-layered testing approach with Jest, React Native Testing Library, Detox, and Maestro.

## 📋 Table of Contents

- [Testing Strategy](#testing-strategy)
- [Quick Start](#quick-start)
- [Jest Unit Tests](#jest-unit-tests)
- [React Native Testing Library](#react-native-testing-library)
- [Detox E2E Tests](#detox-e2e-tests)
- [Maestro E2E Tests](#maestro-e2e-tests)
- [Running All Tests](#running-all-tests)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Testing Strategy

### Testing Pyramid

```
    /\
   /  \  Maestro E2E Tests (10%)
  /    \ Detox E2E Tests (10%)
 /      \ Integration Tests (20%)
/________\ Unit Tests (60%)
```

### Test Types

| Test Type | Framework | Purpose | Speed | Coverage |
|-----------|-----------|---------|-------|----------|
| Unit | Jest + RNTL | Test individual components and functions | Fast | 60% |
| Integration | Jest + RNTL | Test component interactions | Medium | 20% |
| E2E (Detox) | Detox | Test critical user flows | Slow | 10% |
| E2E (Maestro) | Maestro | Test user journeys and cross-platform | Slow | 10% |

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Install Maestro
curl -Ls "https://get.maestro.mobile.dev" | bash

# Make scripts executable
chmod +x run-maestro-tests.sh
chmod +x run-all-tests.sh
```

### Setup

```bash
# Copy environment file for Maestro
cp .maestro/.env.example .maestro/.env

# Edit .maestro/.env with your app details
nano .maestro/.env
```

### Run Tests

```bash
# Run all tests
./run-all-tests.sh

# Or run specific test suites
npm run test              # Jest unit tests
npm run detox:test:ios    # Detox iOS
npm run maestro:test      # Maestro tests
```

## 🧪 Jest Unit Tests

### Overview

Jest is used for unit and integration testing of React components, hooks, and utility functions.

### Structure

```
src/
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── Button.styles.ts
│   └── ...
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts
└── utils/
    ├── validation.ts
    └── validation.test.ts
```

### Writing Tests

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Button } from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button title="Click me" />);
    expect(getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Button title="Click me" onPress={onPress} />
    );
    
    fireEvent.press(getByText('Click me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    const { getByText } = render(
      <Button title="Click me" loading={true} />
    );
    
    expect(getByText('Click me')).toBeDisabled();
  });
});
```

### Running Jest Tests

```bash
# Run all tests
npm run test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test Button.test.tsx

# Run tests matching pattern
npm run test -- --testNamePattern="Button"
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# Open coverage report in browser
open coverage/lcov-report/index.html
```

## 🎭 React Native Testing Library

### Overview

React Native Testing Library (RNTL) is used with Jest to test React Native components in a user-centric way.

### Best Practices

1. **Query by accessibility labels** (most reliable):
```typescript
const button = getByLabelText('Submit form');
```

2. **Query by test ID** (good for dynamic content):
```typescript
const button = getByTestId('submit-button');
```

3. **Query by text** (less reliable, changes frequently):
```typescript
const button = getByText('Submit');
```

### Example Test

```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from './LoginScreen';

describe('LoginScreen', () => {
  it('shows error for invalid credentials', async () => {
    const { getByTestId, getByText } = render(<LoginScreen />);
    
    fireEvent.changeText(getByTestId('email-input'), 'invalid@email');
    fireEvent.changeText(getByTestId('password-input'), 'short');
    fireEvent.press(getByTestId('login-button'));
    
    await waitFor(() => {
      expect(getByText('Invalid credentials')).toBeTruthy();
    });
  });

  it('navigates to home on successful login', async () => {
    const mockNavigate = jest.fn();
    const { getByTestId } = render(
      <LoginScreen navigation={{ navigate: mockNavigate }} />
    );
    
    fireEvent.changeText(getByTestId('email-input'), 'test@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('login-button'));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('Home');
    });
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from './useAuth';

describe('useAuth', () => {
  it('logs in user successfully', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });
    
    expect(result.current.user).toBeTruthy();
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

## 🤖 Detox E2E Tests

### Overview

Detox provides gray-box E2E testing for React Native apps with full control over the app's native layers.

### Structure

```
e2e/
├── config.json
├── firstTest.e2e.js
├── loginFlow.e2e.js
└── utils/
    └── helpers.js
```

### Writing Detox Tests

```javascript
describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should login successfully with valid credentials', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password123');
    await element(by.id('login-button')).tap();
    
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  it('should show error with invalid credentials', async () => {
    await element(by.id('email-input')).typeText('invalid@example.com');
    await element(by.id('password-input')).typeText('wrong');
    await element(by.id('login-button')).tap();
    
    await expect(element(by.text('Invalid credentials'))).toBeVisible();
  });
});
```

### Running Detox Tests

```bash
# iOS
npm run detox:build:ios
npm run detox:test:ios

# Android
npm run detox:build:android
npm run detox:test:android

# Run specific test
npm run detox:test:ios -- e2e/loginFlow.e2e.js

# Debug mode
npm run detox:test:ios -- --loglevel trace
```

### Detox Best Practices

1. Use `testID` props in components
2. Wait for elements to be visible before interaction
3. Use `device.reloadReactNative()` for test isolation
4. Avoid hardcoded waits, use `waitFor` instead
5. Clean up state between tests

## 🎬 Maestro E2E Tests

### Overview

Maestro is a modern, simplified E2E testing framework that doesn't require native code modifications.

### Structure

See `.maestro/README.md` for detailed documentation.

```
.maestro/
├── config.yaml
├── .env
├── flows/
│   ├── 01-app-launch.yaml
│   ├── 02-user-auth.yaml
│   └── ...
└── helpers/
    ├── login.yaml
    └── logout.yaml
```

### Writing Maestro Tests

```yaml
appId: ${APP_ID}
name: User Login Flow
tags:
  - auth
  - critical

---

- launchApp:
    clearState: true

- tapOn: "Login"
- assertVisible: "Email"

- tapOn: "Email"
- inputText: ${TEST_EMAIL}

- tapOn: "Password"
- inputText: ${TEST_PASSWORD}

- tapOn: "Login Button"
- assertVisible: "Welcome"

- takeScreenshot: login-success
```

### Running Maestro Tests

```bash
# Run all tests
npm run maestro:test

# Run specific flow
maestro test .maestro/flows/02-user-auth.yaml

# Run by platform
npm run maestro:test:ios
npm run maestro:test:android

# Run by tag
npm run maestro:test:smoke

# Interactive Studio
npm run maestro:studio
```

### Maestro vs Detox

| Feature | Maestro | Detox |
|---------|---------|-------|
| Setup | Easy | Complex |
| Native code | Not required | Required |
| Speed | Medium | Fast |
| Reliability | High | Very High |
| Debugging | Studio mode | Developer tools |
| CI/CD | Simple | More setup |
| Cross-platform | Excellent | Good |

## 🏃 Running All Tests

### Local Development

```bash
# Run everything
./run-all-tests.sh

# Run specific suites
./run-all-tests.sh --jest-only
./run-all-tests.sh --maestro-only

# Skip specific suites
./run-all-tests.sh --skip-detox
```

### Pre-commit

```bash
# Run fast tests before commit
npm run test
npm run lint
npm run typecheck
```

### Pre-push

```bash
# Run comprehensive tests before push
./run-all-tests.sh --skip-maestro
```

## 🚀 CI/CD Integration

### GitHub Actions

The project includes a comprehensive GitHub Actions workflow (`.github/workflows/test-suite.yml`) that runs:

1. Jest unit tests
2. Detox E2E tests (iOS & Android)
3. Maestro E2E tests (iOS & Android)
4. Coverage reports
5. Test artifacts

### Setup Secrets

Add these secrets in GitHub Settings > Secrets:

```
IOS_APP_ID=com.yourcompany.yourapp
ANDROID_APP_ID=com.yourcompany.yourapp
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword123
```

### Maestro Cloud

For faster CI runs, use Maestro Cloud:

```yaml
- name: Run Maestro tests in cloud
  run: |
    maestro cloud \
      --apiKey ${{ secrets.MAESTRO_CLOUD_API_KEY }} \
      --app ios/build/YourApp.app \
      --flows .maestro/flows
```

## ✅ Best Practices

### General

1. **Write tests first** (TDD when possible)
2. **Keep tests independent** (no shared state)
3. **Use meaningful test names** (describe what, not how)
4. **Test behavior, not implementation**
5. **Mock external dependencies**
6. **Keep tests fast** (unit tests < 1s, E2E < 30s)

### Test Organization

```typescript
describe('Component/Feature', () => {
  // Setup
  beforeEach(() => {
    // Common setup
  });

  describe('when condition A', () => {
    it('should do X', () => {
      // Test
    });

    it('should not do Y', () => {
      // Test
    });
  });

  describe('when condition B', () => {
    it('should do Z', () => {
      // Test
    });
  });
});
```

### Accessibility

```typescript
// Add testID for all interactive elements
<Button testID="submit-button" />
<TextInput testID="email-input" />
<Text testID="error-message" />

// Add accessibility labels
<Button accessibilityLabel="Submit form" />
<Image accessibilityLabel="Profile picture" />
```

### Code Coverage Goals

| Coverage Type | Target | Critical Paths |
|---------------|--------|----------------|
| Statements | 70% | 90% |
| Branches | 70% | 90% |
| Functions | 70% | 90% |
| Lines | 70% | 90% |

## 🔧 Troubleshooting

### Jest Issues

**Tests timing out:**
```typescript
// Increase timeout
jest.setTimeout(10000);

// Or per test
it('slow test', async () => {
  // ...
}, 10000);
```

**Module not found:**
```bash
# Clear Jest cache
npm test -- --clearCache
```

### Detox Issues

**App not launching:**
```bash
# Clean and rebuild
cd ios && xcodebuild clean && cd ..
npm run detox:build:ios
```

**Element not found:**
```javascript
// Wait for element
await waitFor(element(by.id('my-element')))
  .toBeVisible()
  .withTimeout(5000);
```

### Maestro Issues

**Can't find app:**
```bash
# Check app ID
maestro test --env APP_ID=com.yourapp .maestro/flows
```

**Elements not visible:**
```yaml
# Add explicit wait
- waitForAnimationToEnd:
    timeout: 5000
```

### General Tips

1. **Run tests in isolation** to identify flaky tests
2. **Check device/simulator logs** for crashes
3. **Use debug mode** for more verbose output
4. **Update dependencies** regularly
5. **Clean builds** when things get weird

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Detox Documentation](https://wix.github.io/Detox/)
- [Maestro Documentation](https://maestro.mobile.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## 🤝 Contributing

When adding new features:

1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain coverage above 70%
4. Update this documentation
5. Add E2E tests for critical flows

## 📝 Test Checklist

Before submitting a PR:

- [ ] All Jest tests pass
- [ ] Code coverage ≥ 70%
- [ ] Detox tests pass (at least iOS or Android)
- [ ] Maestro smoke tests pass
- [ ] No linting errors
- [ ] TypeScript type checks pass
- [ ] Updated documentation
- [ ] Added tests for new features

---

For questions or issues, please refer to the individual framework documentation or open an issue.
