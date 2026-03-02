# Purrrfect Keys -- System Design, DevOps, AIOps & Scalability Analysis

**Date:** March 2, 2026 (updated)
**Scope:** Production readiness assessment for App Store / Play Store launch
**Codebase snapshot:** 121 test suites, 2,591 tests, 0 TypeScript errors, Expo SDK 52, Firebase 12.9, Gemini 2.0 Flash
**Companion doc:** See `docs/MANUAL-VERIFICATION-CHECKLIST.md` for the hands-on runbook

---

## 1. Current Architecture Assessment

### 1.1 Architecture Strengths

**Offline-first design.** The app is structured so the core loop (exercises, scoring, XP, streaks) works entirely without network connectivity. Local state is managed by 13 Zustand stores persisted via AsyncStorage, with Firebase serving as the sync target rather than the source of truth. This is the correct architecture for a piano learning app where latency and reliability matter most.

**Clean separation of concerns.** `/src/core/` contains pure TypeScript with zero React imports. The scoring engine (`ExerciseValidator`), curriculum engine, skill tree, and music theory utilities are fully testable without any UI framework. This is evidenced by 2,441 passing tests.

**Audio pipeline design.** The latency budgets are well-specified:
- Touch-to-sound: <20ms (achieved via pre-loaded round-robin voice pools in `ExpoAudioEngine`)
- MIDI-to-sound: <15ms
- Mic-to-feedback: <150ms (with compensation applied)

The decision to never process audio buffers in JavaScript is sound. The `ExpoAudioEngine` uses `replayAsync()` for atomic stop+play and pre-loads 50 sound objects (25 notes x 2 voices).

**Graceful degradation is baked in.** The `createAudioEngine()` factory tries WebAudioEngine (JSI) first, falls back to ExpoAudioEngine. `InputManager` auto-detects MIDI > Mic > Touch. `GeminiCoach.getFeedback()` falls back to 50+ offline coaching templates. Auth falls back to a local guest user. TTS uses ElevenLabs neural voices (primary), falling back to expo-speech when API key is missing or network fails.

**AI integration is well-bounded.** Gemini calls happen only for coaching feedback (post-exercise) and exercise generation (pre-session), never in the real-time audio loop. The AI is an enhancement layer, not a dependency.

### 1.2 Architecture Weaknesses

**Gemini API key exposed on client.** Both `GeminiCoach.ts` and `geminiExerciseService.ts` call the Gemini API directly from the React Native client using `EXPO_PUBLIC_GEMINI_API_KEY`. This key is embedded in the app bundle and extractable by anyone who decompiles the APK/IPA. An attacker could use the key to run arbitrary Gemini prompts on the project's billing account.

**No Firestore composite indexes defined.** The file `firebase/firestore.indexes.json` has `"indexes": []`. The `songService.ts` queries filter on `metadata.genre` + `metadata.difficulty` and order by `metadata.title`. Without composite indexes, these queries will fail in production with a Firestore "index required" error.

**Song search is client-side.** `songService.ts` fetches up to 50 documents then filters client-side for text search. At 124 songs this is fine, but at 1,000+ songs this becomes costly in reads and latency.

**Sync queue has no deduplication.** `SyncManager.queueChange()` appends to the queue without checking for existing entries for the same exercise. If a user plays the same exercise 10 times offline, 10 queue entries are created and all 10 are flushed individually rather than merged.

**AsyncStorage as persistence layer.** The persistence layer uses AsyncStorage, which is JSON-serialized and async. At launch scale, startup hydration of 10+ stores from AsyncStorage will add measurable time to cold start. Switch to MMKV for 30x faster reads.

**~~`deleteUserData` does not delete subcollections.~~** **RESOLVED (Feb 28).** Cloud Function `deleteUserData` now handles GDPR-compliant deletion: 9 subcollections, friend codes, league membership, challenges (bidirectional), friend list cleanup, root user document. Client-side fallback `deleteUserDataClientSide()` mirrors the Cloud Function logic. 10 unit tests cover both paths.

**Single Firebase region.** Config is hardcoded to `us-central1`. Users in Europe or Asia will experience 100-300ms additional latency.

**No rate limiting on client-side Gemini calls.** A bug in the curriculum engine could trigger hundreds of generation calls.

### 1.3 Single Points of Failure

| Component | Risk | Impact |
|-----------|------|--------|
| Gemini API key (client-side) | Key extraction, billing abuse | Financial loss, service disruption |
| Firestore (single region) | Regional outage | All cloud features unavailable |
| AsyncStorage corruption | Corrupted JSON | Full data loss for user (no backup) |
| `syncProgress` Cloud Function | Cold start + unhandled edge cases | Sync failures, data divergence |
| `@google/generative-ai` SDK | Version breaking change or deprecation | AI coaching and generation breaks |

### 1.4 Scalability Bottlenecks

1. **Firestore document reads per song browse.** Each `getSongSummaries` call reads entire `Song` documents just to display title/genre/difficulty. At 20 songs per page with 5-10 KB each, this is expensive.

2. **SyncLog growth.** Every exercise completion writes to `users/{uid}/syncLog`. Without proper indexing or cleanup, query performance degrades.

3. **League rotation at scale.** The planned `rotateLeagues()` Cloud Function must process all active league groups every Monday. At 100K users with 30-person leagues = 3,333+ league documents.

---

## 2. High Availability Design

### 2.1 Firebase HA Patterns

**Recommendation:** Since the project is not yet in production, recreate the Firestore database in `nam5` (US multi-region) configuration before launch. This provides HA across Iowa and South Carolina with automatic failover.

For global users, add a secondary Firebase project in `eur3` for European users — defer until measurable European adoption.

### 2.2 Offline-First Resilience

The current design is already strong. Gaps to address:

1. **No offline indicator in UI.** Add a subtle "Offline — your progress is saved locally" banner.
2. **Merge conflicts are server-wins.** The `pullRemoteProgress` uses "highest wins" for XP/scores (correct), but sync log defaults to "server wins" which could silently drop local exercise completions.
3. **Queue size limit of 100 drops oldest entries.** Increase to 500 or implement compaction.

### 2.3 Graceful Degradation Strategy

| Service Down | Current Behavior | Recommended Improvement |
|-------------|-----------------|------------------------|
| Firebase Auth | Local guest mode | Already solid |
| Firestore | Sync silently fails, retries | Add offline banner; increase queue limit |
| Gemini (coaching) | Falls back to offline templates | Already solid |
| Gemini (generation) | Returns null, static exercises used | Add monitoring |
| ElevenLabs TTS | Falls back to expo-speech | Already solid |
| PostHog | `initialized` check prevents crashes | Already solid |
| ONNX Runtime | Falls back to YIN monophonic | Already solid |
| Network (complete) | Full app works offline | Add UI indicator |

---

## 3. Performance & Speed Optimization

### 3.1 App Startup Time

**Switch from AsyncStorage to MMKV** — synchronous reads, 30x faster. Estimated 200-500ms faster cold start.

**Parallel store hydration** — Load all 10 store keys in a single `AsyncStorage.multiGet()` call.

**Lazy-load heavy screens** — SongLibraryScreen, CatSwitchScreen, ProfileScreen via `React.lazy()`.

### 3.2 Firebase Query Optimization

**Define composite indexes** for songs collection (genre + difficulty + title).

**Denormalize song summaries** — Create lightweight `songSummaries` collection (~200 bytes each).

**Cache song catalogue locally** with version check.

### 3.3 Gemini API Latency Reduction

- **Pre-generate coaching for static exercises** — eliminate Gemini calls for 30 static exercises (40% savings)
- **Move Gemini calls to Cloud Functions** — solves key exposure + enables global cache
- **Batch exercise generation** — 3-5 exercises per prompt (60-75% fewer calls)

### 3.4 Bundle Size Optimization

| Dependency | Size Impact | Recommendation |
|-----------|-------------|----------------|
| `firebase` (v12.9) | ~400KB gzipped | Use modular imports (already done) |
| `onnxruntime-react-native` | ~5MB native | Lazy-load when polyphonic mode selected |
| `abcjs` | ~200KB | Lazy-load in SongPlayerScreen |
| `@react-three/fiber` (v8, installed) | ~1.3MB | Lazy-load; download models from CDN |

---

## 4. Cost Optimization

### 4.1 Firebase Costs

| Scale | Firestore | Functions | Auth | Storage | Total/Month |
|-------|-----------|-----------|------|---------|-------------|
| 10K MAU | $22 | $1 | $0 | $2 | ~$25 |
| 100K MAU | $216 | $10 | $0 | $20 | ~$250 |
| 1M MAU | $2,160 | $100 | $0 | $200 | ~$2,500 |

### 4.2 Gemini API Costs

| Users | Daily Active | Gemini Cost/Month |
|-------|-------------|------------------|
| 10K | 3K | ~$27 |
| 100K | 30K | ~$270 |
| 1M | 300K | ~$2,700 |

With optimizations (pre-generation, global cache, batching): 50-60% reduction.

### 4.3 ElevenLabs TTS Costs

**Status: Integrated (Mar 2).** Two-tier pipeline: ElevenLabs `eleven_turbo_v2_5` (primary) → expo-speech (fallback). 13 unique per-cat voices with file-based caching.

| Plan | Characters/Month | Monthly Cost | Approx. TTS Calls |
|------|----------------|--------------|--------------------|
| Free | 10,000 | $0 | ~100 coaching messages |
| Starter | 30,000 | $5 | ~300 coaching messages |
| Creator | 100,000 | $22 | ~1,000 coaching messages |
| Pro | 500,000 | $99 | ~5,000 coaching messages |

**Cost optimization:** File-based caching eliminates repeat calls for identical text+voice. Coaching feedback (2-3 sentences, ~100 chars) × 10 daily sessions = ~1,000 chars/day per active user. At 3K DAU: ~3M chars/month → Creator plan ($22/month) covers it. The expo-speech fallback is free and provides graceful degradation if quota is exceeded.

### 4.4 Cost Control Guardrails

1. Set Firebase budget alerts at $50, $100, $500/month
2. Set Gemini API quota to 1,000 RPM
3. Per-user Gemini rate limiting: max 20/hour, 100/day
4. Monitor anomalies via PostHog

---

## 5. Concurrent Users & Scale Planning

### 5.1 Firestore Limits

- 1M concurrent connections (30K at peak with 100K MAU — well within limits)
- Current polling architecture (5-min flush) is more connection-efficient than real-time listeners
- For leaderboards: use `onSnapshot` sparingly (one per active league view)

### 5.2 Cloud Functions

- Migrate to 2nd-gen (Cloud Run-based) for `minInstances: 1` (warm instances)
- Support up to 1000 concurrent requests per instance (I/O-bound functions)

### 5.3 League Rotation at Scale

- At 100K users: 3,333 leagues, ~60-90 seconds in single function
- At 1M users: Fan out via Cloud Tasks (334 tasks x 100 leagues each)

### 5.4 Push Notifications

~15K FCM messages/day at 100K MAU — trivial (FCM supports 500K messages/second)

---

## 6. DevOps Pipeline

### 6.1 CI/CD Recommendation

```
Push to branch    -> GitHub Actions: typecheck + lint + test
PR to master      -> GitHub Actions: typecheck + lint + test + Detox E2E
Merge to master   -> EAS Build: preview (internal testing)
Git tag vX.Y.Z    -> EAS Build: production + EAS Submit
```

### 6.2 Environment Management

```
.env.development   -> Dev Firebase project, Gemini dev key
.env.staging       -> Staging Firebase project
.env.production    -> Production Firebase project, production Gemini key
```

Separate Firebase projects for dev/staging/prod.

### 6.3 Feature Flags (PostHog)

| Flag | Purpose | Default |
|------|---------|---------|
| `ai_coaching_enabled` | Kill switch for Gemini coaching | ON |
| `ai_generation_enabled` | Kill switch for Gemini generation | ON |
| `polyphonic_detection` | ONNX model for chord detection | OFF |
| `social_features` | Friends, leagues, challenges | ON (implemented) |
| `3d_cat_avatars` | Three.js cat rendering | ON (implemented) |
| `elevenlabs_tts` | Neural TTS voices (vs expo-speech) | ON |

### 6.4 Monitoring Stack

| Layer | Tool |
|-------|------|
| Crash reporting | `@react-native-firebase/crashlytics` |
| Performance | `@react-native-firebase/perf` |
| Analytics | PostHog |
| Backend | Firebase Console + Cloud Monitoring |
| AI Operations | Custom PostHog events |

### 6.5 Release Management

- **OTA Updates:** JS-only changes via `expo-updates` (hours, not days)
- **Native builds:** Every 2-4 weeks (new native deps, SDK upgrades)
- **Versioning:** Semantic + auto-increment build number

---

## 7. AIOps & AI Operations

### 7.1 Gemini Monitoring Metrics

- Success rate (target: >95%)
- P50/P95/P99 latency (target: P95 < 2s coaching, P95 < 5s generation)
- Daily cost (within budget)
- Cache hit rate (target: >60%)
- Fallback invocation rate

### 7.2 Content Quality Monitoring

- Track generation failure rate per SkillTree node
- Track average first-attempt score per AI skill node
- Track user retry rate after AI coaching vs template fallback

### 7.3 Model Fallback Strategy

```
Gemini 2.0 Flash → Gemini 1.5 Flash → Offline templates → Generic message
```

Pre-generate exercise buffer (10-20 per active skill node) for generation failures.

### 7.4 AI Content Validation Pipeline

```
Gemini JSON → Parse → Schema validation → Musical validation
→ Playability check → Content safety → Accept
```

---

## 8. Security

### 8.1 Critical Firestore Rules Fixes

1. Add rules for `songs`, `songMastery`, `songRequests` collections
2. Fix gamification wildcard (too broad — allows any nested document)
3. Add rules for social features (leagues, friendCodes)

### 8.2 API Key Strategy

- **Firebase API Key:** Not secret; protect via App Check
- **Gemini API Key:** CRITICAL — move to Cloud Functions
- **PostHog/Google Sign-In:** Not secret by design

### 8.3 GDPR/Privacy Compliance

1. Create privacy policy (App Store requirement)
2. Add age gate for COPPA compliance
3. Add "Download My Data" button
4. Implement full account deletion (recursive subcollection delete)
5. Disable PostHog session replay by default

---

## 9. Disaster Recovery

### 9.1 Backup Strategy

Daily Firestore exports to Cloud Storage via Cloud Scheduler.
Retention: 30 days daily, 6 months weekly.
Cost: ~$0.02/month at 100K users.

### 9.2 Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Firebase regional outage | 0 (multi-region) | 0 |
| Firestore data corruption | 4 hours | 24 hours |
| Cloud Function bug | 30 min | 0 |
| Gemini API outage | 0 | 0 (auto-fallback) |
| App crash (new release) | 2 hours | 0 (OTA rollback) |

---

## 10. Recommendations (Priority-Ordered)

### P0: Must-Do Before Launch (7-10 days)

| # | Item | Effort | Status |
|---|------|--------|--------|
| 1 | Move Gemini API calls to Cloud Functions | 2-3 days | **CODE DONE** (4 functions written, needs deployment) |
| 2 | Add missing Firestore security rules (songs, songMastery) | 1 hour | TODO |
| 3 | Add composite Firestore indexes | 30 min | TODO |
| 4 | Implement full account deletion (recursive subcollection delete) | 1 day | **DONE** (Cloud Function + client fallback + 10 tests) |
| 5 | Create privacy policy | 1 day | TODO |
| 6 | Integrate Crashlytics | 2 hours | TODO |
| 7 | Set up CI/CD (GitHub Actions + EAS Build) | 1 day | **DONE** (ci.yml + build.yml) |
| 8 | Enable Firebase App Check | 2 hours | TODO |
| 9 | Set Firebase budget alerts | 15 min | TODO |
| 10 | Fix gamification security rules (wildcard too broad) | 30 min | TODO |

### P1: Do Within First Month After Launch

| # | Item | Effort |
|---|------|--------|
| 11 | Switch AsyncStorage to MMKV | 1 day |
| 12 | Pre-generate coaching for static exercises | 1 day |
| 13 | Denormalize song summaries | 1 day |
| 14 | Add offline UI indicator | 2 hours |
| 15 | Set up Firestore daily backups | 2 hours |
| 16 | Add PostHog feature flags | 1 day |
| 17 | Add Gemini monitoring dashboard | 1 day |
| 18 | Batch exercise generation | 1 day |
| 19 | Configure 2nd-gen Cloud Functions | 2 hours |
| 20 | Per-user Gemini rate limiting | 2 hours |

### P2: Do as User Base Grows Past 10K

| # | Item | Effort |
|---|------|--------|
| 21 | Switch Firestore to multi-region (`nam5`) | New project |
| 22 | Full-text search (Algolia/Typesense) for songs | 3 days |
| 23 | Global coaching cache via Cloud Functions | 2 days |
| 24 | CDN for 3D models | 2 days |
| 25 | Sync queue compaction | 1 day |
| 26 | SyncLog TTL cleanup | 2 hours |
| 27 | League rotation fan-out | 2 days |
| 28 | COPPA compliance | 3-5 days |
| 29 | Secondary Firebase project for EU | 1 week |
| 30 | Load testing (10K concurrent users) | 2 days |

---

## Summary

The Purrrfect Keys codebase is architecturally sound for a pre-launch app. The offline-first design, clean separation between core logic and UI, well-specified audio latency budgets, and comprehensive test coverage (2,591 tests) are significant strengths.

**Completed since initial assessment (Feb 28 → Mar 2):**
- Account deletion: GDPR-compliant Cloud Function + client-side fallback (P0 #4 → DONE)
- CI/CD: GitHub Actions workflows for typecheck+lint+test and EAS Build (P0 #7 → DONE)
- Cloud Functions: 4 functions written for Gemini API security (P0 #1 → CODE DONE, needs deployment)
- ElevenLabs TTS: Neural per-cat voices with expo-speech fallback (new capability)
- 3D Ghibli rendering: Toon materials, bone-weight mesh splitting, warm lighting (new capability)

**Remaining critical items:** The **client-side Gemini API key** (Cloud Functions are written but need deployment), **missing Firestore security rules**, and **missing composite indexes** are the top blockers.

Firebase costs are projected to be very manageable: ~$25/month at 10K MAU, ~$250/month at 100K MAU, ~$2,500/month at 1M MAU. ElevenLabs TTS adds ~$22/month at scale (Creator plan). AI optimizations can reduce Gemini costs by 50-60%.
