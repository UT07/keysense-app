# KeySense Master Plan

**Last Updated:** February 16, 2026
**Goal:** Production-quality piano learning app on App Store & Play Store

---

## Status Overview

| Phase | Name | Status | Progress |
|-------|------|--------|----------|
| Phase 1 | Core Loop | **COMPLETE** | 100% |
| Phase 2 | Gamification & Polish | **COMPLETE** | 100% |
| Phase 3 | Firebase Auth + Sync | **COMPLETE** | 100% |
| Phase 4+ | Adaptive Learning + Gamification UI Overhaul | **COMPLETE** | 100% (22/22 tasks) |
| — | Avatar Redesign + Rive System | **COMPLETE** | 100% |
| — | Gameplay UX Rework | **COMPLETE** | 10/10 tasks — vertical notes, smart keyboard, demo mode, ghost notes, 1109 tests |
| Next | Game Feel & Polish | **PLANNED** | 0% — fun facts, transitions, micro-interactions |
| Phase 6 | Social & Advanced Gamification | **PLANNED** | 0% |
| Phase 7 | Music Library | **DESIGNED** | 0% |
| Phase 7.5 | Pre-Launch QA Sprint | **PLANNED** | 0% — AI quality, performance, gamification, content |
| Phase 8 | App Store Launch | **PLANNED** | 0% |

**Current Codebase Health:** 0 TypeScript errors, 1,109 tests passing, 46 suites

---

## Phase 1: Core Loop (COMPLETE)

Everything needed for a single lesson to be fully playable end-to-end.

| Feature | Status |
|---------|--------|
| Exercise Player (PianoRoll + Keyboard) | Done |
| Scoring engine (5-dimensional: accuracy, timing, completeness, extra notes, duration) | Done |
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

## Phase 2: Gamification & Polish (COMPLETE)

### Completed Items
- Score bug fix (rounded integers)
- LevelMapScreen (Duolingo-style vertical map, replaces LearnScreen)
- Concert Hall dark theme across all 20+ screens/components
- Profile editing (daily goal picker, volume control)
- MIDI testing documentation
- Keyboard auto-scroll + dark theme
- Lessons 2-6 E2E validated — all 30 exercises across 6 lessons
- Content bug fix: lesson-03-ex-02 had wrong note
- Orphan file cleanup: removed 3 legacy/duplicate files
- Onboarding persistence fix — `settingsStore` hydrated on startup
- Audio engine rewrite — round-robin voice pools with `replayAsync()`
- Low-latency audio engine — `react-native-audio-api@0.9.3` with JSI
- 4 HIGH-severity bug fixes, 5 MEDIUM-severity bug fixes
- Mascot ("Keysie") — MascotBubble + 55 tips, KeysieSvg avatar (5 moods, 4 sizes)
- ScoreRing, PressableScale, transition screens (LessonComplete, ExerciseCard, AchievementToast, ConfettiEffect)
- Multi-touch keyboard, auto-scroll, single-note highlighting, mastery tests
- Cat character system (8 cats, CatAvatar, CatPickerModal)
- Audio sustain fix, react-native-screens pinned to 4.4.0

---

## Phase 3: Firebase Auth + Sync (COMPLETE)

| Feature | Status |
|---------|--------|
| Firebase Auth (Email, Google, Apple, Anonymous) | Done |
| Auth screens with session persistence | Done |
| Navigation guards (signed-in vs anonymous) | Done |
| SyncManager with offline queue | Done |
| `syncAfterExercise()` wired in ExercisePlayer | Done |
| `startPeriodicSync()` in App.tsx | Done |
| `migrateLocalToCloud()` on first sign-in | Done |
| Display name sync | Done |
| User profile (AccountScreen) | Done |

---

## Phase 4+: Adaptive Learning + Gamification UI Overhaul (COMPLETE)

Design: `docs/plans/2026-02-16-gamification-adaptive-design.md`
Implementation: `docs/plans/2026-02-16-gamification-adaptive-implementation.md`

22 tasks across 6 phases, all completed. Key deliverables:

### Phase A: Foundation Layer
| Task | Feature | Status |
|------|---------|--------|
| 1 | Design tokens (`COLORS`, `GRADIENTS`, `GLOW`, `SPACING`) | Done |
| 2 | Learner profile store (per-note accuracy, skills, tempo range) | Done |
| 3 | Cat dialogue system (8 personalities x 11 triggers, ~440 messages) | Done |
| 4 | Cat mood engine (happy/neutral/sleepy) | Done |

### Phase B: Adaptive Engine
| Task | Feature | Status |
|------|---------|--------|
| 5 | Gemini AI exercise generation service | Done |
| 6 | Exercise buffer manager (FIFO, auto-refill) | Done |
| 7 | 15 offline template exercises (5 easy/5 med/5 hard) | Done |
| 8 | Wire adaptive engine to exercise completion | Done |

### Phase C: Entry Assessment & AI Flow
| Task | Feature | Status |
|------|---------|--------|
| 9 | Skill assessment screen (5-round onboarding) | Done |
| 10 | Post-curriculum AI exercise flow | Done |

### Phase D: UI Overhaul
| Task | Feature | Status |
|------|---------|--------|
| 11 | HomeScreen redesign (gradient header, streak flame, daily challenge, cat companion) | Done |
| 12 | LevelMap redesign (improved node styling with design tokens) | Done |
| 13 | CompletionModal celebration (XP popup, confetti enhancements) | Done |
| 14 | ProfileScreen redesign (level ring, stat cards, achievement showcase) | Done |
| 15 | DailyChallengeCard (shimmer border, 2x XP, countdown) | Done |
| 16 | StreakFlame + XpPopup animations | Done |
| 17 | OnboardingScreen polish (animated progress bar, walking cat) | Done |

### Phase E: Keyboard & Two-Handed Play
| Task | Feature | Status |
|------|---------|--------|
| 18 | SplitKeyboard component | Done |
| 19 | Wire SplitKeyboard to ExercisePlayer | Done |

### Phase F: Achievement Expansion
| Task | Feature | Status |
|------|---------|--------|
| 20 | 32 achievements across 13 condition types | Done |
| 21 | Cat quest service (daily rotating quests, per-cat templates) | Done |
| 22 | Final integration & verification (0 TS errors, 983 tests) | Done |

---

## Avatar Redesign + Rive System (COMPLETE)

| Feature | Status |
|---------|--------|
| 8 unique cat visual identities (body colors, patterns, eye colors) | Done |
| KeysieSvg rewritten with `visuals` prop + 5 pattern renderers | Done |
| CatAvatar animations (floating idle, bounce entry, glow aura) | Done |
| CatSwitchScreen Subway Surfers-style gallery | Done |
| RiveCatAvatar wrapper (Rive-first, SVG fallback) | Done |
| ExerciseBuddy (mini reactive companion during gameplay) | Done |
| Cat avatar integrated across 9 screens | Done |
| `rive-react-native` v9.8.0 installed | Done |
| Actual .riv animation files (needs Rive editor) | Pending |

---

## Gameplay UX Rework (COMPLETE)

User tested on iPhone 13 Pro, identified critical UX issues. All 10 tasks delivered across 2 commits.

### What Was Built
| Feature | Details |
|---------|---------|
| **VerticalPianoRoll** | Top-to-bottom falling notes (Synthesia-style), replacing horizontal scroll |
| **Smart Keyboard** | `computeZoomedRange` — 1-2 octaves auto-selected from exercise notes |
| **Demo Mode** | Visual-only note demonstration via `DemoPlaybackService` |
| **Ghost Notes** | Semi-transparent note overlays after 3 failed attempts |
| **Speed Selector** | 0.5x / 0.75x / 1.0x playback speed control |
| **ExerciseBuddy Dialogue** | Cat companion triggers contextual tips during demo/ghost |
| **Portrait Layout** | Full ExercisePlayer rewrite for portrait orientation |
| **exerciseStore** | New fields: ghostNotes, demoWatched, failCount, playbackSpeed |
| **44 ExercisePlayer Tests** | Comprehensive test coverage for all new features |
| **Integration Tests** | Updated ExerciseFlow tests with Zustand-compatible mocks |

### Architecture Decision: Why NOT edge keys (discussed & rejected)
- Breaks piano spatial mapping (keys run left-to-right on real pianos)
- Black keys have no natural position on vertical edge strips
- Two-hand split inverts muscle memory (thumbs wrong direction)

---

## Phase 5: Game Feel & Polish (PLANNED)

Separate phase, not blocking priority features. Can run in parallel with or after the gameplay UX rework.

| Area | What | Inspiration |
|------|------|-------------|
| Pre-Level Screen | Fun fact + animated mascot + countdown before each exercise | Duolingo lesson intros |
| Avatars | Actual Rive .riv animation files for all 8 cats | Subway Surfers characters |
| Progression Feel | Animated XP bar, level-up celebrations, streak animations | Duolingo XP system |
| Transitions | Screen transitions with personality (slide/bounce/fade) | Duolingo's smooth flow |
| Micro-interactions | Button press animations, haptic patterns, sound effects | Subway Surfers UI |

---

## Phase 6: Social & Advanced Gamification (PLANNED)

### 6A. Community & Social
- Friends system, activity feed, friend challenges, share achievements

### 6B. Leagues & Leaderboards
- Weekly leagues (Bronze → Diamond), promotion/demotion, ranked list

### 6C. Awards & Achievements System
- 30+ unlockable badges, badge gallery, push notifications

### 6D. Gifts & Rewards
- Daily login rewards, streak rewards, streak freeze, gift system

---

## Phase 7: Music Library (DESIGNED)

### 7A. Data Model & Infrastructure
- Song format extending Exercise JSON with layers (melody, leftHand, fullArrangement)

### 7B. MIDI Pipeline — 100+ Songs
- Public domain MIDI → Exercise JSON pipeline (Classical, Pop, Film, Jazz, Folk, Games, Holiday)

### 7C. Music Library UI
- Browse screen with genre carousel, song cards, search/filters

### 7D. Music Gamification
- Mastery tiers per song (Bronze→Platinum), weekly challenges, collections

---

## Phase 7.5: Pre-Launch QA Sprint (PLANNED)

Comprehensive testing before App Store submission. Covers all aspects of the app.

| Area | Tests | Pass Criteria |
|------|-------|---------------|
| AI Coach Quality | 20 exercises scored, review feedback quality | 80%+ feedback rated "helpful" by tester |
| AI Exercise Generation | Generate 50 exercises, validate musicality | No broken exercises, difficulty matches profile |
| Performance | Profile on iPhone 13 Pro + low-end Android | <20ms touch-to-sound, 60fps PianoRoll, <2s screen load |
| Gamification | Full lesson 1-6 playthrough + mastery tests | Progression feels fair, XP/streaks correct |
| UI/UX | All screens walkthrough, both orientations | No broken layouts, consistent theme, accessible |
| Content | Validate all 30+ exercises | No wrong notes, smooth difficulty curve |
| Offline | Full session without network | Core loop works, sync resumes on reconnect |
| Edge Cases | Kill mid-exercise, rapid navigation, etc. | No crashes, state recovery |
| Demo Mode | Test on all 6 lessons | Demo plays correctly, ghost notes work, auto-fade triggers |

---

## Phase 8: App Store Launch (PLANNED)

| Task | Deliverable |
|------|-------------|
| Build finalization | EAS Build, native MIDI, code signing |
| Performance optimization | Profile, fix jank, reduce bundle size |
| App Store assets | Icon, screenshots, description, privacy policy |
| Beta testing | TestFlight + Internal Testing |
| Launch | Submit to stores, monitor crashes |

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audio engine | react-native-audio-api + ExpoAudioEngine fallback | JSI-based low latency, graceful degradation |
| AI challenges | Gemini 2.0 Flash | Fast, cheap, sufficient for JSON generation |
| Avatar animation | rive-react-native (legacy) | Rive-first with SVG fallback; new Nitro needs SDK 53+ |
| State management | Zustand v5 with MMKV persistence | Simple, performant, TypeScript-first |
| Scoring model | 5-factor weighted (accuracy 35%, timing 30%, duration 15%, completeness 10%, extra notes 10%) | Balanced for piano learning |

## Monthly Cost Projections

| Scale | Firebase | Gemini AI | Total |
|-------|----------|-----------|-------|
| 100 DAU | ~$5 | ~$6 | ~$11/mo |
| 1K DAU | ~$25 | ~$30 | ~$55/mo |
| 10K DAU | ~$150 | ~$150 | ~$300/mo |
