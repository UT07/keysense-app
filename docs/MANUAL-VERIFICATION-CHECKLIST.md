# Manual Verification Checklist

**Purpose:** Concrete steps YOU need to execute before launch — things that require your Firebase Console, GCP access, Apple Developer account, physical devices, or human judgment.
**Companion:** `docs/system-design-analysis.md` (architecture analysis), `docs/plans/UNIFIED-PLAN.md` Phase 11 (full QA audit)

---

## Legend

- **[BLOCKER]** — Must fix before ANY public release. App Store will reject or users will hit hard failures.
- **[CRITICAL]** — Must fix before launch. Security/data-loss risk.
- **[IMPORTANT]** — Should fix before launch. Significant UX or reliability gap.
- **[NICE]** — Can ship without, but fix within first month.

---

## A. Firebase Console — Security & Infrastructure

### A1. Firestore Security Rules [BLOCKER]

The current `firebase/firestore.rules` is **missing rules for 6+ collections** added in Phases 9-10.5. Without these, any authenticated user can read/write any other user's social data, songs, and league info.

- [ ] Open Firebase Console → Firestore → Rules
- [ ] Add rules for these collections (currently unprotected):
  - `songs` — public read, admin-only write
  - `users/{uid}/songMastery/{songId}` — owner read/write only
  - `users/{uid}/songRequests/{requestId}` — owner read/write, rate limit
  - `leagues/{leagueId}` — authenticated read, server-only write (Cloud Functions)
  - `leagues/{leagueId}/members/{uid}` — owner can update own `weeklyXp`
  - `friendCodes/{code}` — authenticated read, owner write
  - `users/{uid}/friends/{friendId}` — owner read/write
  - `users/{uid}/activityFeed/{itemId}` — friends read, owner write
  - `challenges/{challengeId}` — participants read/write
- [ ] Fix the gamification wildcard (`match /{document=**}` under `users/{uid}/gamification`) — it's too broad, allows any nested path
- [ ] Deploy updated rules: `firebase deploy --only firestore:rules`
- [ ] **Test from a second account** that you CANNOT read another user's progress, friends, or songMastery

### A2. Firestore Composite Indexes [BLOCKER]

`firebase/firestore.indexes.json` has `"indexes": []`. Song queries will throw "index required" errors in production.

- [ ] Open Firebase Console → Firestore → Indexes
- [ ] Create these composite indexes:
  - Collection `songs`: `metadata.genre` ASC + `metadata.title` ASC
  - Collection `songs`: `metadata.difficulty` ASC + `metadata.title` ASC
  - Collection `songs`: `metadata.genre` ASC + `metadata.difficulty` ASC + `metadata.title` ASC
  - Collection `leagues`: `tier` ASC + `weekStartDate` ASC + `memberCount` ASC
  - Collection path `users/{uid}/songMastery`: `masteryTier` ASC + `lastPlayed` DESC
- [ ] Export indexes: Firebase Console → Indexes → download JSON, save to `firebase/firestore.indexes.json`
- [ ] **Test:** Open SongLibraryScreen, filter by genre, filter by difficulty — no errors in console

### A3. Gemini API Key Security [CRITICAL]

The Gemini API key is currently embedded in the client bundle (`EXPO_PUBLIC_GEMINI_API_KEY`). Anyone who decompiles the APK can extract it and run arbitrary Gemini prompts on your billing.

**Decision needed:**
- [ ] Option A (Recommended): Move Gemini calls to Cloud Functions (2-3 days work)
  - Create `generateExercise` and `getCoachFeedback` Cloud Functions
  - Client calls Firebase Functions instead of Gemini directly
  - Remove `EXPO_PUBLIC_GEMINI_API_KEY` from client `.env`
- [ ] Option B (Quick fix): Set strict API key restrictions in Google Cloud Console
  - Go to GCP Console → APIs & Services → Credentials
  - Edit the Gemini API key → Application restrictions → iOS/Android apps only
  - Add bundle ID restrictions
  - Set per-key quota: 100 RPM, $50/day budget
- [ ] Whichever option: verify `EXPO_PUBLIC_GEMINI_API_KEY` is in `.gitignore` and never committed

### A4. Firebase Budget Alerts [CRITICAL]

- [ ] Firebase Console → Usage and billing → Set budget alerts at:
  - $25/month (warning)
  - $50/month (warning)
  - $100/month (critical — investigate immediately)
- [ ] GCP Console → Billing → Budget → Create budget for the Firebase project
- [ ] Set Gemini API quota: GCP Console → APIs → Generative Language API → Quotas → 1,000 RPM

### A5. Firebase App Check [IMPORTANT]

Prevents unauthorized apps from using your Firebase backend.

- [ ] Firebase Console → App Check → Register app (iOS + Android)
- [ ] For iOS: use DeviceCheck provider
- [ ] For Android: use Play Integrity provider
- [ ] Enforce App Check on Firestore and Cloud Functions
- [ ] Test that the app still works after enforcement

### A6. Account Deletion [BLOCKER]

App Store requires functional account deletion. Current `deleteUserData` only deletes the root `users/{uid}` doc — subcollections are orphaned.

- [ ] Verify `deleteUserData` recursively deletes:
  - `users/{uid}/progress/*`
  - `users/{uid}/gamification/*`
  - `users/{uid}/syncLog/*`
  - `users/{uid}/xpLog/*`
  - `users/{uid}/songMastery/*`
  - `users/{uid}/songRequests/*`
  - `users/{uid}/friends/*`
  - `users/{uid}/activityFeed/*`
  - `users/{uid}/settings/*`
- [ ] Also clean up:
  - Remove user from `leagues/{leagueId}/members/{uid}`
  - Remove user's `friendCodes/{code}` entry
  - Remove user from all `challenges/{id}` where they're a participant
- [ ] **Test:** Create test account → add data → delete account → verify Firestore is clean

---

## B. DevOps & CI/CD

### B1. CI/CD Pipeline [IMPORTANT]

There are **zero GitHub Actions workflows** in the repo. Every push is unvalidated.

- [ ] Create `.github/workflows/ci.yml`:
  ```yaml
  on: [push, pull_request]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 20 }
        - run: npm ci
        - run: npm run typecheck
        - run: npm run lint
        - run: npm run test -- --ci --maxWorkers=2
  ```
- [ ] Create `.github/workflows/build.yml` (on tag push → EAS Build)
- [ ] Push and verify first CI run passes
- [ ] Add branch protection on `master`: require CI pass before merge

### B2. Environment Management [IMPORTANT]

- [ ] Verify `.env.local` is in `.gitignore`
- [ ] Run `git log --all --full-history -- "*.env*"` to check no `.env` was ever committed
- [ ] If found: rotate ALL exposed keys immediately
- [ ] Create separate Firebase projects for staging vs production (or at minimum, set up a staging Firestore database)
- [ ] Document environment setup in a private doc (not in repo)

### B3. Crash Reporting [IMPORTANT]

No Crashlytics integration exists. Production crashes will be invisible.

- [ ] Install: `npx expo install @react-native-firebase/crashlytics`
- [ ] Add to `app.json` plugins
- [ ] Rebuild dev client
- [ ] Verify crash reports appear in Firebase Console → Crashlytics
- [ ] Test: throw an intentional error → verify it appears in dashboard

### B4. OTA Updates [NICE]

- [ ] Verify `expo-updates` is configured in `app.json`
- [ ] Set update channel: `production` for App Store builds
- [ ] Test an OTA update: publish update → verify app picks it up
- [ ] Set rollout percentage (start at 10%, monitor, then 100%)

### B5. EAS Build Configuration [IMPORTANT]

- [ ] Review `eas.json`: verify `production` profile has correct bundle IDs
- [ ] Run `eas build --platform ios --profile production` (dry run first)
- [ ] Run `eas build --platform android --profile production`
- [ ] Verify build sizes are reasonable (<100MB for iOS, <80MB for Android)

---

## C. App Store Requirements [BLOCKER]

### C1. Privacy Policy

- [ ] Create a privacy policy page (hosted URL required for App Store)
- [ ] Must cover: data collected, how it's used, third-party services (Firebase, Gemini, PostHog)
- [ ] Must state: audio is processed on-device only, never transmitted
- [ ] Must include: how to request data deletion
- [ ] Add URL to app settings and App Store listing

### C2. App Store Assets

- [ ] App icon: 1024x1024 PNG (no alpha channel)
- [ ] Screenshots: 6.7" iPhone (1290x2796) — 3-6 screens
- [ ] Screenshots: 6.1" iPhone (1170x2532) — 3-6 screens
- [ ] Optional: iPad screenshots if supporting iPad
- [ ] App Store description (max 4000 chars)
- [ ] Keywords (100 chars max)
- [ ] App category: Education → Music
- [ ] Age rating: complete the questionnaire (likely 4+)

### C3. App Store Connect Setup

- [ ] Create App Store Connect record
- [ ] Fill in app metadata
- [ ] Set pricing: Free
- [ ] Upload TestFlight build
- [ ] Add internal testers (5-10 people)

---

## D. Physical Device Testing (Cannot Be Simulated)

### D1. Audio Fidelity

- [ ] **iPhone:** Play 10+ exercises — listen for clicks, pops, dropped notes
- [ ] **iPhone:** Rapid note sequences (8th notes at 120 BPM) — verify no audio dropout
- [ ] **iPhone:** Play with volume at 100% — verify no distortion
- [ ] **Android (if available):** Repeat above tests — Android audio latency varies by device
- [ ] **Bluetooth headphones:** Verify audio still works (will have higher latency)
- [ ] **Silent mode:** Verify audio plays even when phone is on silent (common iOS issue)

### D2. MIDI Keyboard

- [ ] Connect a USB MIDI keyboard via adapter
- [ ] Verify device is detected in Settings → Input Method
- [ ] Play single notes → verify correct pitch recognition
- [ ] Play chords → verify all notes detected
- [ ] Play fast passages → verify low latency (<15ms target)
- [ ] Disconnect keyboard mid-exercise → verify graceful fallback to touch

### D3. Microphone

- [ ] Grant mic permission via MicSetupScreen
- [ ] Quiet room: play single notes on acoustic piano → verify detection
- [ ] Noisy environment: verify AmbientNoiseCalibrator adjusts thresholds
- [ ] Polyphonic mode: play 2-3 note chords → verify ONNX model detects multiple pitches
- [ ] ONNX model loading: verify `basic-pitch.onnx` loads from assets without crash
- [ ] If ONNX fails: verify automatic fallback to YIN monophonic

### D4. 3D Rendering

- [ ] HomeScreen: 3D cat renders without GL crashes
- [ ] CompletionModal: 3D cat with correct pose
- [ ] CatSwitchScreen: 3D cats for owned, SVG for locked
- [ ] Low-end device (if available): verify no excessive battery drain from 3D
- [ ] Background → foreground: GL context survives app backgrounding

### D5. Performance

- [ ] Cold start time: tap icon → interactive HomeScreen (target: <3s)
- [ ] Exercise Player: touch key → hear sound (perceived latency)
- [ ] Play 10 exercises in a row: verify no memory growth (check Xcode Instruments)
- [ ] Leave app open 30 minutes: verify no battery drain spikes
- [ ] Airplane mode: verify full core loop works offline

---

## E. Firebase Data Integrity

### E1. Verify Existing Firestore Data

- [ ] Check `songs` collection: 124 documents present
- [ ] Spot-check 5 songs: verify `metadata`, `sections`, `abcNotation` fields are populated
- [ ] Check `users` collection structure: at least your test account has correct subcollections
- [ ] Check `leagues` collection: verify structure matches leagueService expectations

### E2. Sync Integrity

- [ ] Device A: complete 3 exercises → verify scores saved to Firestore
- [ ] Device B: sign in with same account → verify all 3 scores appear
- [ ] Device A: complete exercise offline → go online → verify sync completes
- [ ] Conflict: complete same exercise on both devices → verify "highest wins" merge

### E3. Data Migration

- [ ] Fresh install: complete exercises as anonymous user
- [ ] Sign in with email → verify local data migrates to cloud
- [ ] Sign out → verify data preserved locally
- [ ] Sign in with different account → verify clean slate (no data bleed)

---

## F. Security Spot-Checks

### F1. Authentication

- [ ] Sign up with new email → verify email sent (if email verification enabled)
- [ ] Attempt to access Firestore directly via REST API without auth → should be rejected
- [ ] Verify anonymous users cannot access social features
- [ ] Verify JWT token refresh works (leave app open > 1 hour)

### F2. Data Isolation

- [ ] Create 2 test accounts (Account A and Account B)
- [ ] Account A: add progress, friends, song mastery
- [ ] Account B: verify CANNOT see Account A's data in any screen
- [ ] Firestore Console: verify rules reject cross-user reads

### F3. Input Sanitization

- [ ] Friend code input: try entering special characters, SQL-like strings, scripts
- [ ] Song search: try XSS-style inputs (`<script>alert(1)</script>`)
- [ ] Verify no crashes or unexpected behavior from malformed input

---

## G. Third-Party Service Verification

### G1. PostHog Analytics

- [ ] Verify PostHog is receiving events (check PostHog dashboard)
- [ ] Verify no PII is being tracked (no emails, names in event properties)
- [ ] Verify session replay is OFF by default (privacy)
- [ ] Test feature flags work (if configured)

### G2. Gemini AI

- [ ] GCP Console: check Gemini API usage/billing
- [ ] Verify rate limiting works: spam exercise generation → should be throttled
- [ ] Verify offline fallback: disable WiFi → AI coach shows template response
- [ ] Verify content safety: generated exercises don't contain offensive text

### G3. Expo/EAS

- [ ] Verify EAS project is linked: `eas whoami`
- [ ] Verify push notification credentials (if using push): `eas credentials`
- [ ] Review `eas.json` build profiles match your signing credentials

---

## H. Monitoring & Alerting Setup (Post-Launch)

### H1. Firebase Monitoring

- [ ] Enable Firebase Performance Monitoring
- [ ] Set up Cloud Monitoring alerts for:
  - Cloud Function error rate > 5%
  - Cloud Function latency P95 > 5s
  - Firestore reads > 100K/day (anomaly detection)
- [ ] Set up Firestore daily backup (Cloud Scheduler → `gcloud firestore export`)

### H2. App Monitoring

- [ ] Crashlytics: verify crash-free rate visible
- [ ] Set up Slack/email alerts for:
  - Crashlytics: new crash cluster
  - Firebase: budget threshold exceeded
  - EAS Build: build failure

### H3. On-Call Plan

- [ ] Document who monitors what after launch
- [ ] Document hotfix process: bug report → fix → OTA update (or App Store update if native)
- [ ] Define rollback plan: how to revert a bad OTA update

---

## Quick Reference: Priority Order

| Priority | Section | Est. Time | Must Complete Before |
|----------|---------|-----------|---------------------|
| 1 | A1: Firestore Rules | 2-3 hours | Any beta testing |
| 2 | A2: Firestore Indexes | 30 min | Any beta testing |
| 3 | A6: Account Deletion | 1 day | App Store submission |
| 4 | C1: Privacy Policy | 1 day | App Store submission |
| 5 | A3: Gemini Key Security | 2-3 days (Option A) or 1 hour (Option B) | Public launch |
| 6 | A4: Budget Alerts | 15 min | Public launch |
| 7 | B1: CI/CD | 1 day | Before team grows |
| 8 | B3: Crash Reporting | 2 hours | Before beta |
| 9 | C2-C3: App Store Assets | 2-3 days | App Store submission |
| 10 | D1-D5: Device Testing | 2-3 days | Before beta |
| 11 | A5: App Check | 2 hours | Public launch |
| 12 | E1-E3: Data Integrity | 1 day | Before beta |
| 13 | F1-F3: Security Checks | half day | Before beta |
| 14 | B2: Environment Mgmt | half day | Before public launch |
| 15 | G1-G3: Third-party verify | 2 hours | Before beta |
| 16 | B4-B5: OTA + Build | half day | Before beta |
| 17 | H1-H3: Monitoring | 1 day | Within 1 week of launch |

**Total estimated effort: ~12-15 working days**

---

## After Each Phase Audit Template

Use this template after completing each implementation phase to ensure nothing slips through:

```
### Phase [N] Post-Implementation Audit

Date: ____
Phase: ____

#### Code Quality
- [ ] `npm run typecheck` → 0 errors
- [ ] `npm run test` → all pass
- [ ] `npm run lint` → 0 errors
- [ ] No `any` types introduced
- [ ] No console.log statements
- [ ] New stores have persistence + reset()

#### Firebase Impact
- [ ] Security rules updated for new collections?
- [ ] Composite indexes needed for new queries?
- [ ] Cloud Functions updated?
- [ ] Firestore read/write cost impact assessed?

#### Device Testing
- [ ] Core flow tested on physical device
- [ ] Audio features tested on physical device
- [ ] No GL/rendering issues on device
- [ ] Performance acceptable (no jank, no memory leaks)

#### Data Integrity
- [ ] New data persists across app restart
- [ ] New data syncs cross-device (if applicable)
- [ ] Account deletion handles new data

#### Security
- [ ] No API keys exposed
- [ ] User data isolation verified
- [ ] Input sanitization for new user inputs

#### UX Review
- [ ] Navigation flows work (forward + back)
- [ ] Loading states shown for async operations
- [ ] Error states shown for failures
- [ ] Accessibility: labels on new interactive elements
```
