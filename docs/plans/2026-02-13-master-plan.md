# Purrrfect Keys — Master Plan

**Last Updated:** February 23, 2026
**Goal:** Production-quality piano learning app on App Store & Play Store
**Target Launch:** June 8, 2026 (16-week roadmap from Feb 17)
**Codebase Health:** 0 TypeScript errors, 2,135 tests passing, 90 suites

> **This is the single source of truth.** All other plan files in `docs/plans/` are historical archives. Do not reference them for current status.

---

## Status Overview

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| Phase 1 | Core Loop | **COMPLETE** | Exercise Player, scoring, XP, streaks, AI coach, 30 exercises |
| Phase 2 | Gamification & Polish | **COMPLETE** | LevelMap, theme, audio rewrite, mascot system, transitions |
| Phase 3 | Firebase Auth + Sync | **COMPLETE** | Auth (4 providers), cloud sync, offline queue, cross-device |
| Phase 4+ | Adaptive Learning + UI Overhaul | **COMPLETE** | Design tokens, learner profile, Gemini generation, SplitKeyboard, 32 achievements |
| Phase 5 | Adaptive Learning Revamp | **COMPLETE** | SkillTree (100 nodes), CurriculumEngine, voice coaching, weak spots, difficulty engine |
| Phase 5.2 | 365-Day Curriculum | **COMPLETE** | 15 tiers, skill decay, multi-session mastery, session types |
| Phase 6 | Avatar Evolution & Gamification | **COMPLETE** | 4-stage evolution, gems, 12 abilities, cat collection, EvolutionReveal |
| Phase 6.5 | AI Coach Fix + Wiring | **COMPLETE** | 10 coach bugs, FreePlay key detection, gamification wiring |
| Phase 7 | UI Revamp + Game Feel | **COMPLETE** | Concert Hall palette, composable SVG cats, Salsa NPC, custom tab bar, micro-interactions |
| Phase 7.5 | All-AI Exercise Generation | **COMPLETE** | All 6 batches done — skill-aware AI generation for all tiers |
| — | Gem Bug Fix | **COMPLETE** | immediateSave, auto-claim, toast feedback, reward display |
| — | Cat Gallery Redesign | **COMPLETE** | Unified swipeable gallery with abilities, buy flow, evolution data |
| Phase 8 | Audio Input (Mic) | **UP NEXT** | Ship-blocker: pitch detection for 95%+ of users without MIDI |
| — | Sound Design | **PLANNED** | UI sounds, celebrations, cat audio |
| — | Rive Animations | **PLANNED** | .riv files (needs Rive editor guidance) |
| — | Music Library | **PLANNED** | 30+ songs, browse UI, section-based practice |
| Phase 9 | Social & Leaderboards | **PLANNED** | Friends, leagues, challenges, push notifications |
| Phase 10 | QA + Launch | **PLANNED** | Beta testing, App Store submission, monitoring |

---

## Completed Phases (Summary)

### Phase 1: Core Loop
Exercise Player with PianoRoll + Keyboard, 5-dimensional scoring engine, nearest-note matching, XP/levels/streaks, AI Coach (Gemini 2.0 Flash), ContentLoader for 30 JSON exercises across 6 lessons, ExpoAudioEngine with round-robin voice pools, MIDI input architecture.

### Phase 2: Gamification & Polish
LevelMapScreen (Duolingo-style), Concert Hall dark theme, profile editing, all 30 exercises validated, audio engine rewrite (JSI WebAudio + Expo fallback), mascot system (12 cats), ScoreRing, PressableScale, transition screens, multi-touch keyboard.

### Phase 3: Firebase Auth + Sync
Firebase Auth (Email, Google, Apple, Anonymous), SyncManager with offline queue + Firestore pull/merge, cross-device sync ("highest wins"), local-to-cloud migration, auth resilience (guest fallback, 8s timeout).

### Phase 4+: Adaptive Learning + UI Overhaul
22 tasks: design tokens, learner profile store, cat dialogue engine (12 cats x 14 triggers), Gemini exercise generation + buffer manager, skill assessment screen, screen redesigns, SplitKeyboard, 32 achievements, cat quest service.

### Phase 5 + 5.2: Adaptive Learning Revamp + 365-Day Curriculum (~90% + 100%)
SkillTree DAG (100 nodes, 15 tiers, 12 categories), CurriculumEngine (4 session types), skill decay (14-day half-life), AI generation for tiers 7-15, DailySessionScreen, VoiceCoachingService + TTSService, WeakSpotDetector, DifficultyEngine, FreePlayAnalyzer, 150+ new tests.

### Phase 6 + 6.5: Avatar Evolution & Gamification + AI Coach Fix
4-stage evolution (Baby/Teen/Adult/Master), gem currency, 12 abilities via AbilityEngine, CatCollectionScreen, EvolutionReveal animation, GemEarnPopup, onboarding cat selection. AI Coach: 10 bugs fixed (pitchErrors, missedCount, cache, temperature), FreePlay expanded to 48 scales, gamification fully wired.

### Phase 7: UI Revamp + Game Feel & Polish
Concert Hall palette (black + crimson), typography/shadow/animation/glow token systems, composable SVG cat system (12 profiles), Reanimated pose system (7 poses), SalsaCoach NPC, high-impact screen redesigns (Home, CompletionModal, DailySession, Profile), custom tab bar, ExerciseLoadingScreen, hardcoded hex tokenization, cat character renames (Vinyl→Ballymakawww, Noodle→Shibu, Pixel→Bella).

---

## Phase 7.5: All-AI Exercise Generation (COMPLETE)

**Problem:** Only 36 static exercises (~45 min of gameplay). Daily players exhaust content in 2-3 days. Tiers 1-6 are hardwired to static JSON; only tiers 7-15 use AI.

**Goal:** Every exercise from tier 1 onward is AI-generated. Static JSON becomes offline fallback only.

All 6 batches completed: skill mastery for AI exercises, GenerationHints for 100 SkillTree nodes, skill-aware buffer/generation pipeline, CurriculumEngine AI-first for all tiers, LevelMap/LessonIntro AI integration, offline bootstrap + template integration.

---

## Gem Bug Fix + Cat Gallery Redesign (COMPLETE — Feb 23)

### Gem Redemption Bug Fix
- **Root cause:** Race condition between `completeDailyChallenge()` and `claimDailyReward()` — 500ms debounced save loses `lastDailyChallengeDate`
- **Fix:** `createImmediateSave` utility (0ms persistence), `completeDailyChallengeAndClaim()` atomic action, toast feedback on failed claims, reward display on DailyChallengeCard

### Cat Gallery Redesign
- **Unified gallery:** Merged `CatSwitchScreen` + `CatCollectionScreen` into single swipeable Subway Surfers-style gallery
- **Features:** 88%-width cards with evolution stage badge, ability icons, buy flow modal, gem balance header
- **Navigation:** `CatCollection` route now renders `CatSwitchScreen`; `CatCollectionScreen` deprecated

---

## Phase 8: Audio Input — Microphone Pitch Detection (SHIP-BLOCKER)

**Problem:** 95%+ of target users don't own MIDI keyboards. Without mic input, the app is a screen-tap trainer.

**Goal:** Low-latency single-note pitch detection via device microphone. Target: <150ms.

### Current State
- `PitchDetector.ts` — interface exists, C++ TurboModule NOT built
- `AudioEngine` architecture ready (WebAudioEngine JSI + ExpoAudioEngine)
- Scoring engine already handles pitch matching — just needs real input events
- `audio-pipeline.md` documents YIN algorithm spec

### Implementation Options
| Option | Pros | Cons |
|--------|------|------|
| A: C++ TurboModule (YIN) | Lowest latency, spec'd | Most native code work |
| B: expo-av + JS pitch detection | Easy to ship | Higher latency |
| C: Platform native APIs (AVAudioEngine/Oboe) | Best quality | Platform-specific work |

### Key Tasks
1. Choose implementation path
2. Monophonic detection first (polyphonic = research problem)
3. Feed detected pitches as MidiNoteEvent (same interface)
4. Handle sustained notes + ambient noise rejection
5. Calibration flow (mic permission + sensitivity)
6. Input method selector (MIDI / Mic / On-screen)
7. Adaptive timing windows per input method
8. Measure latency on real devices

### Exit Criteria
- Monophonic: >95% accuracy, <200ms latency
- Input method selector in onboarding + settings
- Adaptive timing windows per input type
- Mic calibration flow
- Free play works with mic

---

## Sound Design (PLANNED)

**Problem:** App is silent outside piano note playback. No button sounds, celebrations, feedback, or cat sounds.

### Scope (~20-30 audio assets)
- Button press sounds (tap, toggle, select)
- Celebration sounds (star earned, combo hit, exercise complete, level up)
- Feedback sounds (correct/wrong note, miss)
- Cat sounds (meow greeting, purr reward)
- Countdown ticks

### Design Direction
Hybrid approach: piano-derived sounds for gameplay feedback + cat sounds for mascot interactions.

### Implementation
1. Source/create short .wav assets (<1s each)
2. Create `SoundManager` service (preload + play pattern)
3. Wire into PressableScale, CompletionModal, AchievementToast, ExerciseBuddy, CountInAnimation
4. Separate volume control in settings
5. Respect device silent mode

---

## Rive Animations (PLANNED — Needs Guidance)

**Current state:** SVG composable system with Reanimated poses is functional. `RiveCatAvatar.tsx` placeholder exists but no .riv files.

**What's needed:**
- Rive editor workflow guidance (user has no experience)
- Design + animate 3 cat states minimum: idle, celebrate, teach
- Decision: animate all 12 cats individually vs parameterized rig
- `rive-react-native` integration

**Not a blocker** — current SVG animations work well. This is a quality multiplier.

---

## Music Library (PLANNED)

### Content Pipeline (background work)
- Extend Exercise JSON for songs: layers, sections, difficulty per section, attribution
- MIDI → Exercise JSON conversion script
- 30+ songs: classical (public domain), simplified pop, film/TV, folk, games

### UI Integration
- Browse screen with genre carousel, search, difficulty filter
- Song player: section markers, loop section, skip to chorus
- Song mastery tiers (Bronze → Platinum)
- AI song coaching (trouble spot drills)

---

## Phase 9: Social & Leaderboards (PLANNED)

- Friends system (add via code/link, activity feed)
- Weekly leagues (Bronze → Diamond, 30-person, promotion/demotion)
- Leaderboard UI with animated rank changes
- Friend challenges (beat my score)
- Share achievements to social media
- Firebase backend (Firestore + Cloud Functions for league rotation)
- Push notifications (FCM: reminders, challenges, streak-at-risk)

---

## Phase 10: QA + Launch (PLANNED)

### Weeks 13-14: QA Sprint
- AI quality audit (100 exercises, 20+ coaching scenarios)
- Mic input testing (5+ environments)
- Performance profiling (every screen, target devices)
- Full 30-day simulated journey
- Gamification balance (XP curve, gem rates, evolution milestones)
- Edge cases (kill mid-exercise, airplane mode, background/foreground)
- Accessibility (VoiceOver, dynamic type, color contrast, reduced motion)
- Security (Firebase rules, API keys, input sanitization)

### Week 15: Beta Release
- App Store assets (icon, screenshots, description, privacy policy)
- EAS production builds (iOS + Android)
- TestFlight + internal testing (5-10 testers, 5-day window)
- Critical bug fixes from beta feedback

### Week 16: Launch
- Final fixes
- App Store + Play Store submission
- Launch monitoring (Crashlytics, analytics)
- Post-launch hotfix plan

**Launch is 100% free** — monetization (3-tier freemium) designed post-launch.

---

## Execution Priority

```
[DONE]     Phase 7.5: All-AI Exercises     ✓
[DONE]     Gem Bug Fix + Cat Gallery       ✓
[NOW]      Phase 8: Audio Input (Mic)      ← core ship-blocker, needs R&D
[NEXT]     Sound Design                    ← can prototype alongside audio work
[LATER]    Music Library                   ← content pipeline can run in parallel
[LATER]    Rive Animations                 ← nice-to-have, SVG system is functional
[LATER]    Phase 9: Social & Leaderboards
[LATER]    Phase 10: QA + Launch
```

---

## Timeline (Weeks from Feb 17)

```
WEEK  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
      ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤
PH5   ████████████                 DONE
PH6            ████████████        DONE
PH7                     ████████   DONE
PH7.5                      ██     DONE
GEMS+CAT                     █     DONE
PH8                        ████████     ← NOW  Audio Input
SOUND                         ████      Sound Design
MUSIC ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████  Pipeline → UI
PH9                                  ████████  Social
PH10                                       ████████  Launch
```

We are currently in **Week 5** (Feb 23). Phase 7.5 complete, gem bug fixed, cat gallery redesigned. Phase 8 (Audio Input) is next.

---

## Known Technical Constraints

1. **react-native-screens** pinned to 4.4.0 (Fabric codegen bug with RN 0.76)
2. **Native MIDI module** not installed (needs RN 0.77+). VMPK + IAC Driver ready for testing
3. **Native audio engine** (react-native-audio-api) requires RN 0.77+ for codegen. ExpoAudioEngine is primary
4. **Jest worker teardown warning** — timer leak, non-blocking
5. **~45 open GitHub issues** — to be triaged during QA sprint

---

## Archived Plan Files

The following files are **historical archives only** — do not use for current status:

| File | Original Purpose | Date |
|------|-----------------|------|
| `2026-02-13-adaptive-learning-design.md` | Phase 5 design (superseded by Phase 5 implementation) | Feb 13 |
| `2026-02-13-phase2-completion-design.md` | Phase 2 completion design | Feb 13 |
| `2026-02-13-phase2-implementation.md` | Phase 2 implementation tasks | Feb 13 |
| `2026-02-15-phase2-polish-design.md` | Keysie avatar + polish design | Feb 15 |
| `2026-02-15-phase2-polish-implementation.md` | Keysie avatar implementation | Feb 15 |
| `2026-02-15-firebase-auth-sync-design.md` | Phase 3 auth design | Feb 15 |
| `2026-02-15-firebase-auth-sync-implementation.md` | Phase 3 auth implementation | Feb 15 |
| `2026-02-15-gamification-polish-sprint.md` | Gamification sprint tasks | Feb 15 |
| `2026-02-16-gamification-adaptive-design.md` | Phase 4+ design | Feb 16 |
| `2026-02-16-gamification-adaptive-implementation.md` | Phase 4+ implementation | Feb 16 |
| `2026-02-16-gameplay-ux-rework-design.md` | Vertical PianoRoll design | Feb 16 |
| `2026-02-16-gameplay-ux-rework-implementation.md` | Vertical PianoRoll implementation | Feb 16 |
| `2026-02-17-16-week-roadmap.md` | Original 16-week roadmap (task details still useful for Phases 8-10) | Feb 17 |
| `2026-02-22-next-priorities.md` | Priority analysis (merged into this plan) | Feb 22 |
