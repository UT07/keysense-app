# Crash Reporting Setup Guide

## Recommended: @sentry/react-native

Sentry is the recommended crash reporting solution for Expo managed workflow projects. It provides native crash reporting, JavaScript error tracking, performance monitoring, and source map uploads -- all with first-class Expo support.

**Why Sentry over Firebase Crashlytics:**
- Firebase Crashlytics requires `@react-native-firebase/crashlytics` which adds native module complexity and is harder to configure in Expo managed workflow
- Sentry has an official Expo plugin (`@sentry/react-native`) that handles source maps and native setup automatically
- Sentry provides both crash reporting AND performance monitoring in one SDK

## Installation

```bash
npx expo install @sentry/react-native
```

This installs the Sentry SDK and the Expo config plugin automatically.

## Configuration

### 1. Create a Sentry account and project

1. Sign up at https://sentry.io
2. Create a new project, select "React Native"
3. Note your DSN (Data Source Name) from Project Settings > Client Keys

### 2. Add environment variable

Add to `.env.local`:

```bash
EXPO_PUBLIC_SENTRY_DSN=https://your_key@o12345.ingest.sentry.io/12345
```

Add to `.env.example`:

```bash
# Sentry Crash Reporting
EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
```

### 3. Add the Expo config plugin

In `app.json`, add to the `plugins` array:

```json
{
  "plugins": [
    "@sentry/react-native/expo",
    ...existing plugins
  ]
}
```

### 4. Initialize Sentry in App.tsx

At the top of `src/App.tsx`, before any other imports:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Set to 1.0 for development, lower in production (e.g., 0.2)
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  // Only send events in production
  enabled: !__DEV__,
  // Attach user info for debugging (no PII -- just anonymous ID)
  beforeSend(event) {
    // Scrub any accidentally captured PII
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
```

Wrap the root component:

```typescript
export default Sentry.wrap(App);
```

### 5. Set user context on auth

In `src/stores/authStore.ts`, after successful authentication:

```typescript
import * as Sentry from '@sentry/react-native';

// After auth state changes
Sentry.setUser({
  id: user.uid,
  // Do NOT set email or username for privacy
});

// On sign out
Sentry.setUser(null);
```

### 6. Add breadcrumbs for debugging context

In key user flow points:

```typescript
import * as Sentry from '@sentry/react-native';

// In ExercisePlayer on exercise start
Sentry.addBreadcrumb({
  category: 'exercise',
  message: `Started exercise ${exerciseId}`,
  level: 'info',
});

// In audio engine on initialization failure
Sentry.addBreadcrumb({
  category: 'audio',
  message: 'Audio engine failed to initialize',
  level: 'error',
});
```

### 7. Source map uploads for EAS builds

Add a `sentry.properties` file (or use `SENTRY_AUTH_TOKEN` env var in EAS):

In `eas.json`, add to each build profile:

```json
{
  "build": {
    "production": {
      "env": {
        "SENTRY_AUTH_TOKEN": "your_sentry_auth_token"
      }
    }
  }
}
```

Or set it as an EAS secret:

```bash
eas secret:create --name SENTRY_AUTH_TOKEN --value your_token
```

## Testing Crash Reporting

### In development (temporarily set enabled: true)

```typescript
// Test JavaScript error
Sentry.captureException(new Error('Test error from Purrrfect Keys'));

// Test native crash (only works in dev builds, NOT Expo Go)
Sentry.nativeCrash();

// Test message
Sentry.captureMessage('Test message from Purrrfect Keys');
```

### Verify in Sentry dashboard

1. After triggering a test error, go to your Sentry project dashboard
2. The error should appear within 30 seconds
3. Verify source maps are working (you should see readable TypeScript stack traces)

## Integration with Existing Error Handling

The codebase already has an `analyticsEvents.error.crashReported()` call in PostHog. Sentry should be used alongside this:

```typescript
// In a global error boundary or error handler
try {
  // risky operation
} catch (error) {
  // Report to Sentry (full stack trace + context)
  Sentry.captureException(error);
  // Report to PostHog (analytics event for dashboards)
  analyticsEvents.error.crashReported(
    error instanceof Error ? error.message : String(error),
    error instanceof Error ? error.stack ?? '' : ''
  );
}
```

## Performance Monitoring (Optional)

Sentry can also track slow screens and API calls:

```typescript
// Wrap navigation container for automatic screen tracking
import * as Sentry from '@sentry/react-native';

const routingInstrumentation = new Sentry.ReactNavigationInstrumentation();

Sentry.init({
  // ...other config
  integrations: [
    new Sentry.ReactNativeTracing({
      routingInstrumentation,
    }),
  ],
});

// In NavigationContainer:
<NavigationContainer
  onReady={() => routingInstrumentation.registerNavigationContainer(navigationRef)}
>
```

## Cost Estimate

Sentry free tier: 5,000 errors/month, 10,000 performance transactions/month.
For a pre-launch app, the free tier is more than sufficient.

## Privacy Considerations

- Sentry collects device info (OS version, device model) but NOT location
- Do NOT set `user.email` or `user.ip_address`
- Audio data is never sent -- only structured error context
- Use `beforeSend` callback to scrub any accidentally captured PII
- Review Sentry's data scrubbing settings in Project Settings > Security & Privacy
