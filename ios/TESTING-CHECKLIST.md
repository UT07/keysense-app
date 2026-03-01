# Testing Setup Checklist

Use this checklist to complete your testing setup and start fixing issues.

## ✅ Initial Setup

- [ ] Install Maestro: `curl -Ls "https://get.maestro.mobile.dev" | bash`
- [ ] Copy environment file: `cp .maestro/.env.example .maestro/.env`
- [ ] Update `.maestro/.env` with your app's bundle ID and test credentials
- [ ] Make scripts executable: `chmod +x *.sh`
- [ ] Run setup verification: `./verify-test-setup.sh`

## ✅ Configure Your App

- [ ] Add `testID` props to all interactive components
- [ ] Identify your app's bundle identifier (iOS: `com.company.app`, Android: similar)
- [ ] Create test user account (or use existing credentials)
- [ ] Review your app's navigation structure
- [ ] List critical user flows to test

## ✅ Update Package.json

- [ ] Review `package-scripts-addition.json`
- [ ] Add Maestro scripts to your `package.json`
- [ ] Add testing scripts if missing
- [ ] Install missing dependencies

```bash
npm install --save-dev \
  @testing-library/react-native \
  @testing-library/jest-native \
  jest \
  detox
```

## ✅ Update .gitignore

- [ ] Append contents of `.gitignore-maestro` to your `.gitignore`
- [ ] Ensure `.maestro/.env` is ignored (contains secrets)
- [ ] Ensure test artifacts are ignored

```bash
cat .gitignore-maestro >> .gitignore
```

## ✅ Customize Test Flows

For each flow in `.maestro/flows/`, update:

### 01-app-launch.yaml
- [ ] Replace placeholder selectors with actual UI elements
- [ ] Update navigation assertions
- [ ] Add app-specific launch checks

### 02-user-auth.yaml
- [ ] Update login screen selectors
- [ ] Add actual email/password field IDs
- [ ] Update error message assertions
- [ ] Test your specific auth flow

### 03-form-validation.yaml
- [ ] Identify forms in your app
- [ ] Update input field selectors
- [ ] Add validation error messages
- [ ] Test required field validation

### 04-list-scrolling.yaml
- [ ] Identify list screens
- [ ] Update list item selectors
- [ ] Test infinite scroll if applicable
- [ ] Test search/filter features

### 05-network-loading.yaml
- [ ] Add loading state selectors
- [ ] Test actual API endpoints
- [ ] Test error states

### 06-deep-linking.yaml
- [ ] Update deep link URL scheme
- [ ] Test actual deep link routes
- [ ] Verify navigation after deep link

### 07-gestures.yaml
- [ ] Test swipe actions in your app
- [ ] Test long press if used
- [ ] Test gesture-based navigation

### 08-permissions.yaml
- [ ] Test camera permission if used
- [ ] Test location permission if used
- [ ] Test notification permission
- [ ] Update permission denial flows

### 09-accessibility.yaml
- [ ] Add accessibility labels to components
- [ ] Test VoiceOver/TalkBack
- [ ] Verify accessibility hints

### 10-performance.yaml
- [ ] Test large lists
- [ ] Test rapid navigation
- [ ] Monitor memory usage

### 11-cross-platform.yaml
- [ ] Test on both iOS and Android
- [ ] Handle platform-specific UI
- [ ] Test platform-specific features

### 12-error-handling.yaml
- [ ] Test network errors
- [ ] Test validation errors
- [ ] Test edge cases

## ✅ Run Tests

- [ ] Run single flow: `./run-maestro-tests.sh --flow 01-app-launch`
- [ ] Run all Maestro tests: `npm run maestro:test`
- [ ] Run on iOS: `npm run maestro:test:ios`
- [ ] Run on Android: `npm run maestro:test:android`
- [ ] Run smoke tests: `./run-maestro-tests.sh --tag smoke`
- [ ] Review screenshots in `~/.maestro/tests/`

## ✅ Fix Identified Issues

As tests run, they may reveal issues:

### Common Issues to Fix:

- [ ] **Missing testIDs**: Add to components
  ```jsx
  <Button testID="submit-btn" />
  ```

- [ ] **Slow loading**: Add loading indicators
  ```yaml
  - waitForAnimationToEnd
  ```

- [ ] **Flaky tests**: Add explicit waits
  ```yaml
  - waitForAnimationToEnd:
      timeout: 5000
  ```

- [ ] **Navigation issues**: Fix routing
- [ ] **Validation errors**: Improve form validation
- [ ] **Accessibility**: Add labels and hints
- [ ] **Performance**: Optimize slow screens
- [ ] **Error handling**: Add error boundaries

### Track Issues:

Create a list of issues found:

1. **Issue**: [Description]
   - **Location**: [Screen/Component]
   - **Test**: [Flow that found it]
   - **Fix**: [How you fixed it]
   - **Status**: [Fixed/In Progress/Pending]

## ✅ Test All Suites

- [ ] Run Jest tests: `npm test`
- [ ] Run Detox iOS: `npm run detox:test:ios`
- [ ] Run Detox Android: `npm run detox:test:android`
- [ ] Run all tests: `./run-all-tests.sh`
- [ ] Check coverage: `npm run test:coverage`

## ✅ CI/CD Setup

- [ ] Review `.github/workflows/test-suite.yml`
- [ ] Add GitHub secrets:
  - `IOS_APP_ID`
  - `ANDROID_APP_ID`
  - `TEST_EMAIL`
  - `TEST_PASSWORD`
- [ ] Update workflow with your build commands
- [ ] Test workflow on a feature branch
- [ ] Enable required status checks

## ✅ Documentation

- [ ] Read `TESTING-GUIDE.md`
- [ ] Read `.maestro/README.md`
- [ ] Document your test setup in project README
- [ ] Create testing guidelines for team
- [ ] Document common issues and solutions

## ✅ Code Quality

- [ ] Ensure all tests pass
- [ ] Achieve >70% code coverage
- [ ] Fix all linting errors
- [ ] Fix TypeScript errors
- [ ] Review and fix accessibility issues
- [ ] Optimize performance bottlenecks

## ✅ Team Onboarding

- [ ] Share `MAESTRO-SETUP-COMPLETE.md` with team
- [ ] Train team on writing Maestro tests
- [ ] Setup pre-commit hooks
- [ ] Create test writing guidelines
- [ ] Document test data requirements

## 📊 Success Metrics

Track these metrics:

- **Test Coverage**: _____% (Goal: >70%)
- **Passing Tests**: _____ / _____ (Goal: 100%)
- **E2E Coverage**: _____ flows (Goal: All critical paths)
- **CI/CD Success Rate**: _____% (Goal: >95%)
- **Test Execution Time**: _____ min (Goal: <15 min)

## 🎯 Critical Flows to Test

Identify and test these critical user flows:

- [ ] App Launch → Home Screen
- [ ] User Registration
- [ ] User Login
- [ ] Main Feature 1: _______________
- [ ] Main Feature 2: _______________
- [ ] Main Feature 3: _______________
- [ ] User Logout
- [ ] Error Scenarios
- [ ] Edge Cases

## 🐛 Issue Tracking

Use this template to track issues found during testing:

### Issue #1
- **Title**: _______________
- **Severity**: High / Medium / Low
- **Found in**: [Test name]
- **Steps to reproduce**: 
  1. ...
  2. ...
- **Expected**: _______________
- **Actual**: _______________
- **Status**: Open / In Progress / Fixed
- **Fixed in**: [PR/Commit]

### Issue #2
- **Title**: _______________
- (Same format as above)

## ✨ Bonus Tasks

- [ ] Setup Maestro Cloud for faster CI
- [ ] Create custom helper flows
- [ ] Add visual regression testing
- [ ] Setup test data factory
- [ ] Add API mocking
- [ ] Create test reporting dashboard
- [ ] Add performance benchmarks
- [ ] Setup automated screenshot comparison

## 📝 Notes

Add any project-specific notes here:

---
---
---

## ✅ Final Verification

- [ ] All tests pass locally
- [ ] All tests pass in CI
- [ ] Code coverage meets threshold
- [ ] No critical bugs remaining
- [ ] Documentation is complete
- [ ] Team is trained
- [ ] Ready for production! 🚀

---

**Completed by**: _______________
**Date**: _______________
**Version**: _______________
