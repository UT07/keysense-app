# Manual Verification Checklist

**Purpose:** Concrete steps YOU need to execute before launch — things that require your Firebase Console, GCP access, Apple Developer account, physical devices, or human judgment.
**Companion:** `docs/system-design-analysis.md` (architecture analysis), `docs/plans/UNIFIED-PLAN.md` Phase 11 (full QA audit)

**Last updated:** March 1, 2026
**Codebase health:** 122 test suites, 2,630 tests, 0 failures, 0 TypeScript errors
**Key completions since initial draft:**
- CI/CD workflows created (`.github/workflows/ci.yml` + `build.yml`)
- Account deletion Cloud Function + client-side fallback implemented (10 tests)
- 4 Cloud Functions for Gemini API written (`generateExercise`, `generateSong`, `generateCoachFeedback`, `deleteUserData`)
- Audio session cross-library race condition fixed (AudioManager synchronous config)
- 3D cat models functional (4 GLBs, material override, bounding box camera)
- Maestro E2E test scaffolding created (12 flows + 3 helpers, needs selector work)

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

**Cloud Functions written** (Option A code is done): `generateExercise.ts`, `generateSong.ts`, `generateCoachFeedback.ts`, `deleteUserData.ts` in `firebase/functions/src/`. Client services (`geminiExerciseService`, `songGenerationService`, `GeminiCoach`) already fall back to direct Gemini API if Cloud Function is unavailable.

**Remaining steps:**
- [ ] Deploy Cloud Functions: `cd firebase/functions && npm install && cd ../.. && firebase deploy --only functions`
- [ ] Set `GEMINI_API_KEY` as a Firebase secret: `firebase functions:secrets:set GEMINI_API_KEY`
- [ ] Verify Cloud Functions respond correctly (test exercise generation, song generation, coaching)
- [ ] Once confirmed, remove `EXPO_PUBLIC_GEMINI_API_KEY` from client `.env` — client will use Cloud Functions exclusively
- [ ] As a fallback/short-term measure: set strict API key restrictions in Google Cloud Console
  - Go to GCP Console → APIs & Services → Credentials
  - Edit the Gemini API key → Application restrictions → iOS/Android apps only
  - Add bundle ID restrictions
  - Set per-key quota: 100 RPM, $50/day budget
- [ ] Verify `EXPO_PUBLIC_GEMINI_API_KEY` is in `.gitignore` and never committed

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

App Store requires functional account deletion.

**Status: Code complete.** Cloud Function `deleteUserData` (`firebase/functions/src/deleteUserData.ts`) handles GDPR-compliant deletion via Admin SDK. Client-side fallback `deleteUserDataClientSide()` in `src/services/firebase/firestore.ts` mirrors the Cloud Function logic using client Firestore SDK. `authStore.deleteAccount()` calls `deleteUserData(uid)` → resets all stores → `user.delete()`. 10 unit tests in `src/services/firebase/__tests__/deleteUserData.test.ts`.

**Implemented deletions:** 9 subcollections (progress, settings, songs, mastery, friends, activity, achievements, learnerProfile, catEvolution), `friendCodes/{code}`, league membership, challenges (bidirectional), friend list cleanup (removes user from all friends' lists), root user document.

**Remaining steps:**
- [ ] Deploy Cloud Function: `firebase deploy --only functions:deleteUserData`
- [ ] **Test on real account:** Create test account → add progress, friends, song mastery, league membership → delete account → verify Firestore is clean (all subcollections, friend codes, league entries, challenges removed)
- [ ] Verify `AccountScreen.tsx` delete button triggers the full flow correctly
- [ ] Verify anonymous users cannot trigger account deletion (or handle gracefully)

---

## B. DevOps & CI/CD

### B1. CI/CD Pipeline [IMPORTANT]

**Status: Implemented.** `.github/workflows/ci.yml` runs `npm ci` → `typecheck` → `lint` → `test --ci --maxWorkers=2` on every push and PR. `.github/workflows/build.yml` triggers EAS Build on version tags (`v*`) using `expo/expo-github-action@v8`.

- [x] ~~Create `.github/workflows/ci.yml`~~ — Done
- [x] ~~Create `.github/workflows/build.yml`~~ — Done
- [ ] Push and verify first CI run passes (check GitHub Actions tab)
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

**Audio session fix applied:** The cross-library race condition between expo-av and react-native-audio-api has been resolved. `createAudioEngine.ts` now uses `AudioManager.setAudioSessionOptions()` (synchronous) for all iOS session configuration, eliminating the async overwrite bug where expo-av's `Audio.setAudioModeAsync()` would clobber react-native-audio-api's `AudioSessionManager` internal state. `AudioCapture.ts` uses `AudioManager.requestRecordingPermissions()` and `configureAudioSessionForRecording()` from the same library.

- [ ] Grant mic permission via MicSetupScreen
- [ ] Quiet room: play single notes on acoustic piano → verify detection
- [ ] Noisy environment: verify AmbientNoiseCalibrator adjusts thresholds
- [ ] Polyphonic mode: play 2-3 note chords → verify ONNX model detects multiple pitches
- [ ] ONNX model loading: verify `basic-pitch.onnx` loads from assets without crash
- [ ] If ONNX fails: verify automatic fallback to YIN monophonic
- [ ] Verify audio session does NOT revert to earpiece after mic initialization (the old race condition)

### D4. 3D Rendering

**Status: Functional.** Material override system handles 3 mesh naming conventions (Mat_ prefix, no-prefix, no-materials). Camera framing uses bounding box auto-centering. 4 GLB models (salsa-cat, slim-cat, round-cat, chonky-cat) rendering correctly with per-cat color overrides via `cat3DConfig.ts`.

- [ ] HomeScreen: 3D cat renders without GL crashes
- [ ] CompletionModal: 3D cat with correct pose (score-based)
- [ ] CatSwitchScreen: 3D cats for owned, SVG for locked (verify no multiple GL contexts)
- [ ] Verify per-cat colors: body, belly, ears, eyes, nose, blush all match 2D profiles
- [ ] Low-end device (if available): verify no excessive battery drain from 3D
- [ ] Background → foreground: GL context survives app backgrounding

### D5. Performance

- [ ] Cold start time: tap icon → interactive HomeScreen (target: <3s)
- [ ] Exercise Player: touch key → hear sound (perceived latency)
- [ ] Play 10 exercises in a row: verify no memory growth (check Xcode Instruments)
- [ ] Leave app open 30 minutes: verify no battery drain spikes
- [ ] Airplane mode: verify full core loop works offline

### D6. Maestro E2E Tests

**Status: Scaffolded, needs selector work.** 12 flow files + 3 helper files + config + scripts exist in `ios/.maestro/`. Covers app launch, user auth, form validation, list scrolling, network loading, deep linking, gestures, permissions, accessibility, performance, cross-platform, and error handling.

- [ ] Add `testID` props to key interactive elements in React components (buttons, inputs, screens)
- [ ] Update Maestro YAML selectors to match actual `testID` values
- [ ] Run `ios/run-maestro-tests.sh` against simulator → fix any selector mismatches
- [ ] Verify at least flows 01 (app launch) and 02 (user auth) pass end-to-end
- [ ] Integrate Maestro into CI (optional — can be post-launch)

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

| Priority | Section | Est. Time | Status | Must Complete Before |
|----------|---------|-----------|--------|---------------------|
| 1 | A1: Firestore Rules | 2-3 hours | TODO | Any beta testing |
| 2 | A2: Firestore Indexes | 30 min | TODO | Any beta testing |
| 3 | A6: Account Deletion | Deploy + test | CODE DONE | App Store submission |
| 4 | C1: Privacy Policy | 1 day | TODO | App Store submission |
| 5 | A3: Gemini Key Security | Deploy + test | CODE DONE (4 Cloud Functions) | Public launch |
| 6 | A4: Budget Alerts | 15 min | TODO | Public launch |
| 7 | B1: CI/CD | Verify runs | DONE (ci.yml + build.yml) | Before team grows |
| 8 | B3: Crash Reporting | 2 hours | TODO | Before beta |
| 9 | C2-C3: App Store Assets | 2-3 days | TODO | App Store submission |
| 10 | D1-D5: Device Testing | 2-3 days | TODO | Before beta |
| 11 | D6: Maestro E2E | 1-2 days | SCAFFOLDED (needs selectors) | Before beta |
| 12 | A5: App Check | 2 hours | TODO | Public launch |
| 13 | E1-E3: Data Integrity | 1 day | TODO | Before beta |
| 14 | F1-F3: Security Checks | half day | TODO | Before beta |
| 15 | B2: Environment Mgmt | half day | TODO | Before public launch |
| 16 | G1-G3: Third-party verify | 2 hours | TODO | Before beta |
| 17 | B4-B5: OTA + Build | half day | TODO | Before beta |
| 18 | H1-H3: Monitoring | 1 day | TODO | Within 1 week of launch |

**Total estimated effort: ~10-12 working days** (reduced from 12-15 due to CI/CD, account deletion, and Cloud Functions already implemented)

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
