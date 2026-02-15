# Phase 3: Firebase Auth + Cloud Sync — Design Document

**Date:** 2026-02-15
**Status:** Design approved
**Scope:** Authentication (4 providers), cloud sync, account management, Firebase deployment

---

## 1. Overview

Add user authentication and cloud progress sync to KeySense. Users can start playing immediately (anonymous auth), then optionally create an account to back up progress. Sync happens on exercise completion + periodic background, with offline queue for reliability.

**Existing infrastructure (already written, needs wiring):**
- `AuthService` class with email + Google methods
- Firestore schema (users, progress, gamification, syncLog collections)
- 5 Cloud Functions (syncProgress, completeExercise, getCoachFeedback, etc.)
- Firestore security rules
- Conflict resolution logic (highest score wins)

---

## 2. Auth Providers

| Provider | Implementation | Notes |
|----------|---------------|-------|
| Apple Sign-In | `expo-apple-authentication` | Required by App Store if offering any third-party login |
| Google Sign-In | `@react-native-google-signin/google-signin` | Requires Google Cloud OAuth client ID |
| Email/password | Firebase Auth (existing `AuthService`) | Sign in + sign up + forgot password |
| Anonymous | Firebase Anonymous Auth | Auto-created on "Skip for now", upgradeable via `linkWithCredential()` |

---

## 3. Screens

### 3A. AuthScreen (new)
First screen for unauthenticated users. Keysie mascot (large, celebrating) with greeting.

```
┌─────────────────────────────────────┐
│                                     │
│         🐱 Keysie (large)           │
│       "Let's make music!"           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  🍎  Continue with Apple    │    │  ← iOS only (Platform.OS check)
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  G   Continue with Google   │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  ✉   Continue with Email    │    │
│  └─────────────────────────────┘    │
│                                     │
│       Skip for now (anonymous)      │
│                                     │
└─────────────────────────────────────┘
```

- Apple button: calls `expo-apple-authentication` → `signInWithCredential()`
- Google button: calls `@react-native-google-signin` → `signInWithCredential()`
- Email button: navigates to EmailAuthScreen
- Skip: calls `signInAnonymously()` → proceeds to Onboarding/MainTabs

### 3B. EmailAuthScreen (new)
Toggle between Sign In and Create Account modes.

```
┌─────────────────────────────────────┐
│  ← Back                            │
│                                     │
│  Sign In  |  Create Account  (tabs) │
│                                     │
│  [Email field]                      │
│  [Password field]                   │
│  [Display Name field] (signup only) │
│                                     │
│  [Sign In / Create Account button]  │
│                                     │
│  Forgot Password? (sign-in only)    │
│                                     │
└─────────────────────────────────────┘
```

- Validation: email format, password min 8 chars, display name min 2 chars
- Error display: inline below fields (Firebase error codes → friendly messages, already mapped in AuthService)
- Forgot password: calls `sendPasswordResetEmail()` → shows confirmation toast

### 3C. AccountScreen (new)
Accessible from ProfileScreen. Different layout for authenticated vs anonymous users.

**Authenticated user:**
```
┌─────────────────────────────────────┐
│  ← Account                         │
│                                     │
│  [Avatar]  Display Name             │
│            email@example.com        │
│            Member since Feb 2026    │
│                                     │
│  ── Profile ──────────────────────  │
│  [Change Display Name]              │
│  [Change Password] (email auth only)│
│                                     │
│  ── Linked Accounts ─────────────── │
│  Google    ✓ Connected              │
│  Apple     [Link Account]           │
│                                     │
│  ── Danger Zone ─────────────────── │
│  [Sign Out]                         │
│  [Delete Account] (red)             │
│                                     │
└─────────────────────────────────────┘
```

**Anonymous user:**
```
┌─────────────────────────────────────┐
│  ← Account                         │
│                                     │
│  🐱 Keysie (encouraging)           │
│  "Create an account to save your   │
│   progress across devices!"         │
│                                     │
│  [🍎 Link with Apple]              │
│  [G  Link with Google]             │
│  [✉  Link with Email]             │
│                                     │
│  ── Info ────────────────────────── │
│  Your progress is saved locally.    │
│  Without an account, you'll lose    │
│  it if you reinstall the app.       │
│                                     │
└─────────────────────────────────────┘
```

- Delete account: confirmation dialog → calls `deleteAccount()` (existing) + clears local data → navigates to AuthScreen
- Sign out: confirmation → clears local stores → navigates to AuthScreen
- Link account: `linkWithCredential()` upgrades anonymous → full account

---

## 4. Auth Store

```typescript
// src/stores/authStore.ts

interface AuthState {
  user: FirebaseUser | null;
  isAnonymous: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  initAuth: () => Promise<void>;          // Setup onAuthStateChanged listener
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
  linkWithGoogle: () => Promise<void>;    // Upgrade anonymous
  linkWithApple: () => Promise<void>;
  linkWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  clearError: () => void;
}
```

---

## 5. Sync Service

```typescript
// src/services/firebase/syncService.ts

class SyncManager {
  private offlineQueue: SyncChange[] = [];
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;

  // Called on app launch (after auth)
  startPeriodicSync(intervalMs: number = 300000): void;  // 5 min

  // Called after exercise completion
  syncAfterExercise(exerciseId: string, score: ExerciseScore): Promise<void>;

  // Full bidirectional sync
  syncAll(): Promise<SyncResult>;

  // Offline queue management
  queueChange(change: SyncChange): void;
  flushQueue(): Promise<void>;

  // Cleanup
  stopPeriodicSync(): void;
}

interface SyncChange {
  type: 'exercise_completed' | 'xp_earned' | 'settings_changed';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

interface SyncResult {
  success: boolean;
  changesUploaded: number;
  changesDownloaded: number;
  conflicts: number;
}
```

**Sync triggers:**
1. After exercise completion (immediate)
2. Every 5 minutes (background timer)
3. On app foreground (AppState listener)
4. Manual "Sync Now" button in Profile (optional)

**Conflict resolution:**
- Per-exercise: keep highest score
- XP: keep highest total
- Settings: last-write-wins with timestamp
- Streak data: keep longest streak

**Offline behavior:**
- Queue changes in AsyncStorage (`keysense_sync_queue`)
- Flush queue on next successful sync
- Max queue size: 100 items (oldest dropped)
- Retry with exponential backoff (max 3 retries per item)

---

## 6. Navigation Flow

```
App Launch
    │
    ▼
App.tsx: initAuth()
    │
    ├── Firebase has persisted auth state?
    │   ├── YES → user restored → check onboarding
    │   └── NO → show AuthScreen
    │
    ▼
AuthScreen
    ├── Apple/Google/Email → authenticate → create Firestore profile if new
    └── "Skip" → signInAnonymously()
    │
    ▼
hasCompletedOnboarding?
    ├── NO → OnboardingScreen → MainTabs
    └── YES → MainTabs
    │
    ▼
MainTabs (normal app usage)
    │
    └── Profile → AccountScreen (manage account)
```

**Navigation stack update:**
```
RootStack
├── Auth (if !isAuthenticated)
│   ├── AuthScreen
│   └── EmailAuthScreen
├── Onboarding (if !hasCompletedOnboarding)
├── MainTabs
│   ├── Home, Learn, Play, Profile
├── Exercise (modal)
├── MidiSetup (modal)
└── Account (modal, from Profile)
```

---

## 7. Firebase Project Setup

### 7A. Missing config files to create
- `firebase.json` — configure Firestore rules deploy + Functions deploy
- `.firebaserc` — project alias (`keysense-app`)

### 7B. Google Cloud Console
- Create OAuth 2.0 client IDs (iOS + Web)
- Configure consent screen
- Add SHA-1 fingerprint for Android (when needed)

### 7C. Apple Developer
- Enable "Sign in with Apple" capability
- Configure App ID with Sign in with Apple service

### 7D. Deploy
- `firebase deploy --only firestore:rules` — deploy security rules
- `firebase deploy --only functions` — deploy 5 Cloud Functions

---

## 8. Dependencies

| Package | Purpose | Native rebuild? |
|---------|---------|----------------|
| `@react-native-google-signin/google-signin` | Google auth on mobile | Yes |
| `expo-apple-authentication` | Apple auth on iOS | Yes (but Expo managed) |
| `@react-native-firebase/app` | NOT needed — using Firebase JS SDK | No |

**Note:** We use Firebase JS SDK (`firebase@12.9.0`) which works with Expo. No need for `@react-native-firebase/*` packages.

---

## 9. Data Migration

When a user first authenticates (or upgrades from anonymous):
1. Read all local store data (progressStore, settingsStore)
2. Check if Firestore has existing data for this user
3. If Firestore empty: upload local data as-is
4. If Firestore has data: merge (highest scores, latest settings)
5. Mark migration complete in local storage

---

## 10. Testing Strategy

| Test | Type | What |
|------|------|------|
| AuthStore unit tests | Jest | Sign in/out flows, state transitions, error handling |
| SyncManager unit tests | Jest | Queue management, conflict resolution, retry logic |
| Auth flow integration | Jest | Anonymous → upgrade → sign out cycle |
| Firestore rules | Firebase emulator | Security rule validation |
| Offline queue | Jest | Queue + flush + retry behavior |

---

## 11. Scope Summary

**Building:**
- AuthStore (Zustand)
- SyncManager service
- AuthScreen (Apple + Google + Email + Skip)
- EmailAuthScreen (sign in/up + forgot password)
- AccountScreen (manage account, link providers, delete)
- Navigation guards
- Firebase project config (firebase.json, .firebaserc)
- Data migration (local → cloud)

**Reusing (already written):**
- AuthService class
- Firestore operations (12+ functions)
- 5 Cloud Functions
- Security rules
- Conflict resolution logic

**Explicitly deferred:**
- Push notifications
- Multi-device real-time sync
- Social login with Facebook/Twitter
- Two-factor authentication
