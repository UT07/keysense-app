# KeySense Master Plan

**Last Updated:** February 15, 2026
**Goal:** Production-quality piano learning app on App Store & Play Store

---

## Status Overview

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| Phase 1 | Core Loop | **COMPLETE** | 100% |
| Phase 2 | Gamification & Polish | **NEAR COMPLETE** | ~95% |
| Phase 3 | Firebase Auth + Sync | **PLANNED** | 0% |
| Phase 4 | Adaptive Learning | **DESIGNED** | 0% |
| Phase 5 | Social & Advanced Gamification | **PLANNED** | 0% |
| Phase 6 | Music Library | **DESIGNED** | 0% |
| Phase 7 | App Store Launch | **PLANNED** | 0% |

**Current Codebase Health:** 0 TypeScript errors, 518 tests passing, 23 suites

**Strategy:** Auth first (prerequisite for user data), then deepen the 6-lesson experience with AI-powered adaptive learning, then build social engagement (leagues, friends, achievements) in parallel with Music Library content expansion, then ship.

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

## Phase 2: Gamification & Polish (NEAR COMPLETE — ~95%)

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
- Onboarding persistence fix — `settingsStore` hydrated on startup
- Audio engine rewrite — round-robin voice pools with `replayAsync()` for reliable polyphony
- Low-latency audio engine — `react-native-audio-api@0.9.3` installed with JSI-based Web Audio API
- 4 HIGH-severity bug fixes: MIDI noteOff double-counting, pause/resume reset, stale playedNotes closure, MIDI timestamp normalization
- 5 MEDIUM-severity bug fixes: streak bypass, exercise progress silent drop, practice time tracking, dead code removal, etc.
- Mascot ("Keysie") — MascotBubble component with 55 tips/facts, mood-based avatar, integrated into CompletionModal
- **Keysie SVG avatar** — Full SVG cat character with 5 moods (happy, celebrating, encouraging, teaching, excited), 4 sizes, animated via Reanimated
- **ScoreRing** — Animated SVG circle score indicator with color-coded thresholds
- **PressableScale** — Spring-based press feedback component for buttons
- Transition screens — LessonCompleteScreen (full celebration), ExerciseCard (quick mid-lesson card), AchievementToast (XP/level-up), ConfettiEffect
- Dev Build created for physical device testing (iPhone 13 Pro)
- Documentation updates (stabilization-report.md, CLAUDE.md, MEMORY.md)

### Remaining Items (~4 hours estimated)

#### 2A. Keysie Integration (Priority: HIGH)
Replace emoji avatars with new KeysieAvatar SVG cat across all screens:
- Refactor MascotBubble to use KeysieAvatar (replace emoji)
- Integrate into ExerciseCard, CompletionModal, LevelMap, HomeScreen, LessonCompleteScreen

#### 2B. Visual Polish (Priority: MEDIUM)
- Card shadow standardization across HomeScreen and ProfileScreen
- Keyboard key gradients (white + black keys)

#### 2C. Onboarding Verification (Priority: HIGH)
- Add Keysie to onboarding steps (replacing emoji)
- E2E test: fresh install → onboarding → first exercise
- Verify `hasCompletedOnboarding` persistence

**Effort:** ~4 hours total

---

## Phase 3: Firebase Auth + Sync (~3 days)

**Why now:** Prerequisite for Adaptive Learning (student profiles), Music Library (user-specific data), and any cloud features. Must happen before Phases 4-5.

### 3A. Firebase Authentication (1 day)
- Email/password + Google Sign-In
- Anonymous auth for try-before-signup (convert to full account later)
- Wire to existing Firebase config (`src/services/firebase/`)
- Auth state persistence (stay logged in across app restarts)

### 3B. Progress Cloud Sync (1.5 days)
- Sync `progressStore` to Firestore on changes
- Conflict resolution: latest-write-wins with timestamp
- Offline queue for pending changes (sync when back online)
- Sync on app launch + periodic background sync
- Merge strategy: local progress + cloud progress → pick higher scores

### 3C. User Profile (0.5 days)
- Display name, avatar selection, joined date
- Public profile with stats (optional)
- Account deletion (GDPR/App Store requirement)
- Wire into ProfileScreen

**Key Files:**
- `src/services/firebase/auth.ts` — new
- `src/services/firebase/syncService.ts` — new
- `src/stores/authStore.ts` — new Zustand store
- `src/screens/ProfileScreen.tsx` — modify

---

## Phase 4: Adaptive Learning System (~9-11 days)

**Full design:** `docs/plans/2026-02-13-adaptive-learning-design.md`

Transform KeySense from a linear exercise sequence into a personalized, AI-driven learning experience where every student gets a unique curriculum.

### 4A. Challenge Infrastructure (3-4 days)
- `ChallengeGenerator.ts` — Gemini generates fresh exercise JSON personalized to student
- `ChallengeValidator.ts` — Safety layer rejects invalid AI output (MIDI range, scoring config, note count)
- 3 fallback templates per lesson (18 total) for offline/failure
- Add `"type": "challenge"` to Exercise type
- Wire challenge generation into ExercisePlayer
- Challenge completion tracking in progressStore

### 4B. Student Skill Model (2-3 days)
- `StudentModel.ts` — Per-skill mastery tracking (22 skills from lesson metadata)
- `DifficultyTuner.ts` — Adaptive params (tempo, timing tolerance, passing score, hint level)
- Mastery update rules: diminishing returns, time-based decay, confidence scoring
- Persist to progressStore + sync to Firestore

### 4C. Dynamic Curriculum (3-4 days)
- `CurriculumEngine.ts` — Goal-based ordering (songs/technique/exploration paths)
- `LessonFlowController.ts` — Orchestrates exercise → exercise → challenge → exercise sequence
- Update LevelMapScreen to show challenge nodes
- Unlock logic: all regular exercises + all challenges passed → next lesson

**Key decisions (from brainstorming):**
- Play-based challenges (not text quizzes)
- Gemini generates full exercise JSON
- Challenges sprinkled every 2 exercises
- Full personalization: adaptive difficulty + goal paths + AI ordering

---

## Phase 5: Social & Advanced Gamification (~10-15 days)

**Runs in parallel with Phase 6 (Music Library).** Both phases can start after Adaptive Learning is complete since they're independent.

### 5A. Community & Social (5-7 days)
- **Friends system:** Add friends via username/link, see their progress
- **Activity feed:** "Alex just completed Lesson 4!" — social proof and motivation
- **Challenges between friends:** "Beat my score on Fur Elise" — push notifications
- **Share achievements:** Export achievement cards to social media (Instagram Stories, etc.)
- **Firestore schema:** `users/{uid}/friends`, `activityFeed` collection with fan-out

### 5B. Leagues & Leaderboards (3-4 days)
- **Weekly leagues:** Bronze → Silver → Gold → Diamond (Duolingo-style promotion/demotion)
- **League placement:** Based on weekly XP earned
- **Leaderboard UI:** Ranked list with avatar, XP, streak
- **Promotion/demotion:** Top 10 promote, bottom 5 demote
- **Cloud Functions:** Weekly league reset, rank calculation
- **Firestore schema:** `leagues/{leagueId}/members`, sorted by weeklyXp

### 5C. Awards & Achievements System (2-3 days)
- **Achievement badges:** 30+ unlockable badges (First Note, 7-Day Streak, Perfect Score, etc.)
- **Badge categories:** Milestone, Skill, Social, Challenge, Hidden
- **Achievement gallery:** Dedicated screen showing all badges (earned = color, locked = grey)
- **Push notifications:** Celebrate rare achievements
- **Firestore schema:** `users/{uid}/achievements` with timestamps

### 5D. Gifts & Rewards (1-2 days)
- **Daily login rewards:** Escalating XP bonuses for consecutive days
- **Streak rewards:** Special badges/bonuses at 7, 30, 100, 365 day streaks
- **Streak freeze:** Spend XP to protect streak (max 2 freezes banked)
- **Gift system:** Send encouragement/virtual gifts to friends
- **Premium path (future):** Cosmetic rewards, custom Keysie outfits

**Key dependencies:** Requires Phase 3 (Auth) for user identity. Can run in parallel with Music Library.

---

## Phase 6: Music Library (~25 days)

> Hybrid MIDI Pipeline + Community approach, layered song format, all genres, all free at launch, 100+ songs, full gamification.

### 6A. Data Model & Infrastructure (5 days)

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

### 6B. MIDI Pipeline — Bootstrap 100+ Songs (10 days)

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

### 6C. Music Library UI (5 days)

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

### 6D. Music Gamification Layer (5 days)

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

### 6E. Community Arrangements (Post-Launch)
- Web-based MIDI editor for creating song arrangements
- Submit for review → approved arrangements appear in library
- Creator attribution + play count stats

---

## Phase 7: App Store Launch (~5-7 days)

### 7A. Development Build Finalization (1 day)
- EAS Build configuration for production
- Enable native MIDI module (CoreMIDI on iOS)
- Verify react-native-audio-api works on production build
- Configure code signing (iOS + Android)

### 7B. Performance Optimization (1-2 days)
- Profile and fix any jank (React DevTools Profiler)
- Audio latency testing on physical devices
- Reduce bundle size (tree-shaking, asset optimization)
- Splash screen polish

### 7C. App Store Assets (1 day)
- App icon (1024x1024) and screenshots (6.5" + 5.5" iPhone, iPad)
- App Store description and keywords
- Privacy policy and terms of service
- App Review guidelines compliance check

### 7D. Beta Testing (1-2 days)
- TestFlight (iOS) + Internal Testing (Android)
- Gather feedback from 5-10 beta testers
- Fix critical issues before public launch

### 7E. Launch (1 day)
- Submit to App Store and Play Store
- Monitor crash reports (Firebase Crashlytics)
- PostHog analytics for user behavior
- First-week bug fix sprint

---

## Execution Timeline

```
NOW ──────────────────────────────────────────────────────────→ LAUNCH

Phase 2 Remaining (~4 hours)
├─ Keysie integration (6 screens) ...... [████████░░] HIGH
├─ Card shadows + keyboard gradients ... [████░░░░░░] MEDIUM
└─ Onboarding E2E + Keysie ............ [████████░░] HIGH

Phase 3: Firebase Auth + Sync (3 days)
├─ Authentication ...................... [██████████] HIGH
├─ Progress cloud sync ................. [████████░░] HIGH
└─ User profile ........................ [████░░░░░░] MEDIUM

Phase 4: Adaptive Learning (9-11 days)
├─ Challenge infrastructure ............ [██████████] HIGH
├─ Student skill model ................. [████████░░] HIGH
└─ Dynamic curriculum .................. [████████░░] HIGH

┌── PARALLEL TRACKS (after Phase 4) ──────────────────────────┐
│                                                              │
│  Phase 5: Social & Gamification (10-15 days)                │
│  ├─ Community & social .............. [████████░░] HIGH     │
│  ├─ Leagues & leaderboards .......... [████████░░] HIGH     │
│  ├─ Awards & achievements ........... [████░░░░░░] MEDIUM   │
│  └─ Gifts & rewards ................. [████░░░░░░] MEDIUM   │
│                                                              │
│  Phase 6: Music Library (25 days)                           │
│  ├─ Data model + infra .............. [██████████] HIGH     │
│  ├─ MIDI pipeline (100 songs) ....... [██████████] HIGH     │
│  ├─ Library UI ...................... [████████░░] HIGH     │
│  ├─ Gamification .................... [████░░░░░░] MEDIUM   │
│  └─ Community arrangements .......... [░░░░░░░░░░] LOW     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Phase 7: App Store Launch (5-7 days)
├─ Build finalization .................. [██████████] CRITICAL
├─ Performance optimization ............ [████████░░] HIGH
├─ App Store assets .................... [████████░░] HIGH
├─ Beta testing ........................ [██████████] HIGH
└─ Launch .............................. [██████████] CRITICAL
```

**Total estimated effort: ~53-60 working days** (Phases 5 & 6 overlap saves ~10 days)

### Launch Milestones

| Milestone | What | Days from now |
|-----------|------|--------------|
| Phase 2 Close | All polish done, Keysie integrated | ~0.5 day |
| Auth Ready | Users can sign in, progress syncs | ~3.5 days |
| Adaptive MVP | AI challenges + skill model working | ~14 days |
| Social Features | Leagues, friends, achievements | ~25 days |
| Content Library | 100+ songs playable | ~39 days |
| App Store | Live on iOS + Android | ~46 days |

### MVP Launch Option

**Ship after Phase 4** (Adaptive Learning complete): ~14 days
- 6-lesson learning app with AI-powered adaptive challenges
- No Music Library or Social features (add post-launch)
- Compelling enough for App Store submission

### Mid-tier Launch Option

**Ship after Phase 5** (Social + Adaptive): ~25 days
- 6-lesson app with AI challenges + leagues + friends + achievements
- No Music Library (add post-launch)
- Strong social hooks for retention

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audio engine | react-native-audio-api + ExpoAudioEngine fallback | JSI-based low latency, graceful degradation |
| Song storage | Firebase Storage (JSON) | Cheaper than Firestore for large exercise data |
| Song metadata | Firestore | Real-time queries, search, sorting |
| Local caching | AsyncStorage + file system | Offline-first for downloaded songs |
| MIDI pipeline | Node.js scripts | Same TS tooling as the app |
| AI challenges | Gemini 2.0 Flash | Fast, cheap, sufficient for JSON generation |
| Community arrangements | Web editor (future) | Separate from mobile app complexity |
| Leaderboards | Firestore + Cloud Functions | Real-time updates, server-side validation |

## Monthly Cost Projections

| Scale | Firebase | Gemini AI | Total |
|-------|----------|-----------|-------|
| 100 DAU | ~$5 | ~$6 | ~$11/mo |
| 1K DAU | ~$25 | ~$30 | ~$55/mo |
| 10K DAU | ~$150 | ~$150 | ~$300/mo |

All within Firebase free tier for initial launch. Gemini costs assume 80% cache hit rate.
