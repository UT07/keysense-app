# KeySense Master Plan

**Last Updated:** February 13, 2026
**Goal:** Production-quality piano learning app on App Store & Play Store

---

## Status Overview

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Core Loop | **COMPLETE** | 100% |
| Phase 2: Gamification & Polish | **NEAR COMPLETE** | ~90% |
| Phase 3: Music Library | **DESIGNED** | 0% |
| Phase 4: Firebase Sync & Auth | **PLANNED** | 0% |
| Phase 5: App Store Launch | **PLANNED** | 0% |

**Current Codebase Health:** 0 TypeScript errors, 506 tests passing, 19 suites

---

## Phase 1: Core Loop (COMPLETE)

Everything needed for a single lesson to be fully playable end-to-end.

| Feature | Status |
|---------|--------|
| Exercise Player (PianoRoll + Keyboard) | Done |
| Scoring engine (4-dimensional: accuracy, timing, completeness, precision) | Done |
| Nearest-note matching (real-time visual feedback) | Done |
| XP system with level auto-calculation | Done |
| Streak tracking & daily goals | Done |
| AI Coach (Gemini 2.0 Flash with 5-tier fallback) | Done |
| Content loading from JSON (31 exercises, 6 lessons) | Done |
| Practice time tracking | Done |
| Next exercise navigation + try again on failure | Done |
| Dynamic Keyboard/PianoRoll range per exercise | Done |
| ExpoAudioEngine with sound pooling (14 pre-loaded notes) | Done |
| MIDI input architecture (NoOp fallback for Expo Go) | Done |
| Concert Hall dark theme (#0D0D0D + #DC143C crimson) | Done |
| Keyboard auto-scroll to follow exercise notes | Done |
| Landscape orientation lock for gameplay | Done |

---

## Phase 2: Gamification & Polish (IN PROGRESS)

### Completed Items
- Score bug fix (rounded integers)
- LevelMapScreen (Duolingo-style vertical map, replaces LearnScreen)
- Concert Hall dark theme across all 20+ screens/components
- Profile editing (daily goal picker, volume control)
- MIDI testing documentation (`agent_docs/midi-integration.md`)
- Keyboard auto-scroll + dark theme
- Lessons 2-6 E2E validated — all 30 exercises across 6 lessons (MIDI ranges, scoring, unlock chain)
- Content bug fix: lesson-03-ex-02 had wrong note (G#/Ab3 in C major scale) — corrected
- Orphan file cleanup: removed 3 legacy/duplicate files
- Onboarding persistence fix — `settingsStore` hydrated on startup (was not loading `hasCompletedOnboarding`)
- Audio engine rewrite — round-robin voice pools with `replayAsync()` for reliable polyphony
- 4 HIGH-severity bug fixes: MIDI noteOff double-counting, pause/resume reset, stale playedNotes closure, MIDI timestamp normalization
- 5 MEDIUM-severity bug fixes: streak bypass, exercise progress silent drop, practice time tracking, dead code removal, etc.
- Mascot ("Keysie") — MascotBubble component with 55 tips/facts, mood-based avatar, integrated into CompletionModal
- Transition screens — LessonCompleteScreen (full celebration), ExerciseCard (quick mid-lesson card), AchievementToast (XP/level-up), ConfettiEffect
- Dev Build created for physical device testing (iPhone 13 Pro)
- Documentation updates (stabilization-report.md, CLAUDE.md, MEMORY.md)

### Remaining Items (~2-3 days estimated)

#### 2A. Onboarding Flow Activation (Priority: HIGH)
**Why:** Onboarding persistence fixed, but flow may still need functional wiring.

- OnboardingScreen UI exists (4 steps: Welcome, Experience, Equipment, Goal)
- `settingsStore.hasCompletedOnboarding` now persists correctly
- Need to verify full flow: new user → onboarding → first exercise
- **Effort:** 0.5 day

#### 2B. UI Polish Pass (Priority: MEDIUM)
**Why:** Production readiness requires visual refinement.

- HomeScreen: level progress bar, gradient header, card shadow consistency
- ProfileScreen: weekly practice chart, gradient stats header
- CompletionModal: gradient score ring refinement
- LevelMapScreen: path fill animation on lesson completion
- **Effort:** 2 days

#### 2C. AI Adaptive Learning System (Priority: HIGH — Phase 2 End)
**Full design:** `docs/plans/2026-02-13-adaptive-learning-design.md`

Three increments:
- **2C-1:** Challenge infrastructure — AI generates exercise JSON, validation pipeline, fallback templates (3-4 days)
- **2C-2:** Student skill model — per-skill mastery tracking, adaptive difficulty tuning (2-3 days)
- **2C-3:** Dynamic curriculum — goal-based paths, exercise reordering, LessonFlowController (3-4 days)

Key decisions: play-based challenges (not text quizzes), Gemini generates full exercise JSON, challenges sprinkled every 2 exercises, full personalization (adaptive difficulty + goal paths + AI ordering).

---

## Phase 3: Music Library (DESIGNED, NOT STARTED)

> Based on brainstorming session. User chose: Hybrid MIDI Pipeline + Community approach, layered song format, all genres, all free at launch, 100+ songs, full gamification.

### 3A. Data Model & Infrastructure (~5 days)

**Song Format:** Extended Exercise JSON with layers
```
Song
├── Metadata (title, artist, genre, difficulty, duration, album art)
├── Layers
│   ├── melody (right hand only) — Exercise JSON
│   ├── leftHand (left hand only) — Exercise JSON
│   └── fullArrangement (both hands) — Exercise JSON
├── Community fields (plays, ratings, arrangements)
└── Mastery tracking (per-layer star ratings)
```

**Storage Plan:**
- Firestore: song metadata + user progress
- Firebase Storage: exercise JSON + album art
- Local cache: downloaded songs for offline play

**Key Tasks:**
- Define `Song` TypeScript interface extending `Exercise`
- Create `SongLoader` service (download + cache + offline)
- Add `songProgress` to `progressStore` (per-layer mastery)
- Create Firestore schema for songs collection
- **Prerequisite:** Phase 4 (Firebase Auth) for user-specific data

### 3B. MIDI Pipeline — Bootstrap 100+ Songs (~10 days)

**Source:** Public domain MIDI files (Mutopia, IMSLP, Musescore community)

**Pipeline:**
1. Parse MIDI files → extract melody + left hand tracks
2. Quantize to beat grid, normalize tempo
3. Convert to Exercise JSON format (note, startBeat, durationBeats)
4. Auto-generate difficulty ratings based on note density/range/rhythm complexity
5. Create 3 layers per song: melody-only → left-hand → full arrangement
6. Quality review (reject poorly quantized or overly complex arrangements)

**Genre Distribution (100 songs):**
| Genre | Count | Examples |
|-------|-------|---------|
| Classical | 25 | Fur Elise, Moonlight Sonata, Canon in D |
| Pop/Rock | 25 | Let It Be, Imagine, Bohemian Rhapsody |
| Film/TV | 15 | Star Wars, Harry Potter, Game of Thrones |
| Jazz Standards | 10 | Fly Me to the Moon, Autumn Leaves |
| Folk/Traditional | 10 | Greensleeves, Amazing Grace |
| Video Games | 10 | Mario, Zelda, Tetris |
| Holiday | 5 | Jingle Bells, Silent Night |

**Key Tasks:**
- Build MIDI parser script (Python or Node)
- Create quality validation pipeline
- Generate Exercise JSON for each layer
- Upload to Firebase Storage with metadata
- **Effort:** 8-10 days (bulk processing + manual QA)

### 3C. Music Library UI (~5 days)

**Browse Screen (new tab or section):**
- Genre carousel (horizontal scroll)
- Song cards with album art, difficulty badge, play count
- Search with filters (genre, difficulty, duration)
- "New This Week" / "Trending" / "Staff Picks" sections

**Song Detail Screen:**
- Album art hero
- Layer selector (Melody / Left Hand / Full Arrangement)
- Mastery progress per layer (star display)
- Play button → ExercisePlayer with selected layer
- Community stats (plays, average score)

**Key Tasks:**
- Create `MusicLibraryScreen` (browse + search)
- Create `SongDetailScreen` (layer selection + mastery)
- Add "Music" tab to bottom navigation
- Wire to ExercisePlayer for playback
- **Files:** New screens + AppNavigator update

### 3D. Gamification Layer (~5 days)

**Mastery Tiers per Song:**
| Tier | Requirement |
|------|-------------|
| Bronze | Complete melody layer (any score) |
| Silver | 3-star melody + complete left hand |
| Gold | 3-star both layers + complete full arrangement |
| Platinum | 3-star all three layers |

**Weekly Challenges:**
- "Play 5 Classical songs" → bonus XP
- "Master 3 songs this week" → special badge
- Challenge rotation via Firebase Remote Config

**Collections:**
- "80s Pop Hits" — complete 5/10 songs to earn collection badge
- "Movie Magic" — film theme collection
- Auto-generated based on genre/era groupings

**Leaderboards (optional, Phase 5):**
- Weekly top scorers per song
- Monthly XP leaderboard
- Friends leaderboard (requires social features)

### 3E. Community Arrangements (Future — Post-Launch)

**Arrangement Editor:**
- Web-based MIDI editor for creating song arrangements
- Submit for review → approved arrangements appear in library
- Creator attribution + play count stats

**Cost Estimate:**
- MIDI processing pipeline: ~$0 (public domain sources)
- Firebase Storage: ~$5/month for 100 songs
- Firestore reads: ~$10/month at 1K DAU
- Total Phase 3 infrastructure: ~$15/month

---

## Phase 4: Firebase Sync & Auth (~3 days)

### 4A. Firebase Authentication
- Email/password + Google Sign-In
- Anonymous auth for try-before-signup
- Wire to existing Firebase config

### 4B. Progress Cloud Sync
- Sync `progressStore` to Firestore on changes
- Conflict resolution: latest-write-wins with timestamp
- Offline queue for pending changes
- Sync on app launch + periodic background sync

### 4C. User Profile
- Display name, avatar, joined date
- Public profile with stats (optional)
- Account deletion (GDPR/App Store requirement)

**Prerequisite for:** Music Library user data, leaderboards, community features

---

## Phase 5: App Store Launch (~5-7 days)

### 5A. Development Build Migration
- Switch from Expo Go to EAS Development Build
- Enable native MIDI module (CoreMIDI on iOS)
- Enable native audio engine (react-native-audio-api)
- Configure code signing (iOS + Android)

### 5B. Performance Optimization
- Profile and fix any jank (React DevTools Profiler)
- Audio latency testing on physical devices
- Reduce bundle size (tree-shaking, asset optimization)
- Splash screen polish

### 5C. App Store Assets
- App icon (1024x1024) and screenshots (6.5" + 5.5" iPhone, iPad)
- App Store description and keywords
- Privacy policy and terms of service
- App Review guidelines compliance check

### 5D. Beta Testing
- TestFlight (iOS) + Internal Testing (Android)
- Gather feedback from 5-10 beta testers
- Fix critical issues before public launch

### 5E. Launch
- Submit to App Store and Play Store
- Monitor crash reports (Firebase Crashlytics)
- PostHog analytics for user behavior
- First-week bug fix sprint

---

## Recommended Execution Order

```
NOW ──────────────────────────────────────────────────────────→ LAUNCH

Phase 2 Remaining (2-3 days)
├─ 2A: Onboarding verification ...... [████████░░] HIGH
├─ 2B: UI polish pass ............... [████░░░░░░] MEDIUM
└─ 2C: Adaptive Learning System ..... [██░░░░░░░░] HIGH (design done)

Phase 4: Firebase Auth + Sync (3 days)
├─ 4A: Authentication ............... [██████████] HIGH
├─ 4B: Progress sync ................ [████████░░] HIGH
└─ 4C: User profile ................. [████░░░░░░] MEDIUM

Phase 3: Music Library (25 days)
├─ 3A: Data model + infra ........... [██████████] HIGH
├─ 3B: MIDI pipeline (100 songs) .... [██████████] HIGH
├─ 3C: Library UI ................... [████████░░] HIGH
├─ 3D: Gamification ................. [████░░░░░░] MEDIUM
└─ 3E: Community (post-launch) ...... [░░░░░░░░░░] LOW

Phase 5: App Store Launch (5-7 days)
├─ 5A: Dev build migration .......... [██████████] CRITICAL
├─ 5B: Performance optimization ..... [████████░░] HIGH
├─ 5C: App Store assets ............. [████████░░] HIGH
├─ 5D: Beta testing ................. [██████████] HIGH
└─ 5E: Launch ....................... [██████████] CRITICAL
```

**Total estimated effort: ~40-45 working days**

### Critical Path

The fastest path to App Store launch:
1. **Phase 2 remaining** (3-5 days) — complete the core learning experience
2. **Phase 5A** (2 days) — dev build, because native MIDI + audio require it
3. **Phase 4** (3 days) — auth + sync, required for user data persistence
4. **Phase 3A-C** (20 days) — Music Library core (minimum viable library)
5. **Phase 5B-E** (5 days) — launch prep

**MVP Launch (without Music Library): ~13 days**
This gives you a fully functional 6-lesson learning app with gamification.

**Full Launch (with Music Library): ~40 days**
Complete experience with 100+ songs, mastery tiers, and challenges.

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Song storage | Firebase Storage (JSON) | Cheaper than Firestore for large exercise data |
| Song metadata | Firestore | Real-time queries, search, sorting |
| Local caching | AsyncStorage + file system | Offline-first for downloaded songs |
| MIDI pipeline | Node.js scripts | Same TS tooling as the app |
| Community arrangements | Web editor (future) | Separate from mobile app complexity |
| Leaderboards | Firestore + Cloud Functions | Real-time updates, server-side validation |

## Monthly Cost Projections

| Scale | Firebase | Gemini AI | Total |
|-------|----------|-----------|-------|
| 100 DAU | ~$5 | ~$6 | ~$11/mo |
| 1K DAU | ~$25 | ~$30 | ~$55/mo |
| 10K DAU | ~$150 | ~$150 | ~$300/mo |

All within Firebase free tier for initial launch. Gemini costs assume 80% cache hit rate.
