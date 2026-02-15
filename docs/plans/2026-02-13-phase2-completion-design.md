# Phase 2 Completion Design

**Date:** February 13, 2026
**Status:** Approved
**Scope:** Complete Phase 2 (Gamification & Polish) per PRD

## Context

Phase 1 (Core Loop) is complete with extras: XP/levels, streaks, AI coach (originally Phase 2-3 items) are already working. This phase completes remaining Phase 2 items and adds polish.

## Deliverables

### 1. Score Bug Fix -- DONE
- Rounded scores at both engine and display layer
- All breakdown values show clean integers

### 2. Lessons 2-6 E2E Testing -- DONE
- All 30 exercises across 6 lessons validated (MIDI ranges, scoring configs, beat sequencing)
- Content bug fixed: lesson-03-ex-02 had wrong note (G#/Ab3 in C major descent)
- 3 orphan files removed (legacy/duplicate)
- Lesson unlock chain verified (lesson-01 → lesson-06)
- Scoring pipeline tested: perfect play scores 90%+, no play scores 0

### 3. Level Map UI (replaces LearnScreen) -- DONE
- Vertical scrolling map with lesson nodes connected by paths
- Node states: completed (green), current (pulsing), locked (grey)
- Auto-scroll to current lesson on mount
- Tap to navigate to first uncompleted exercise

### 4. Onboarding Flow -- PARTIAL
- 4 screens exist (Welcome, Experience, Equipment, Goal)
- Settings persistence fixed (settingsStore hydrated on startup)
- Need to verify full new-user flow end-to-end

### 5. UI Polish (Own Identity) -- PARTIAL
- Concert Hall dark theme complete
- Profile editing (daily goal, volume) complete
- Remaining: gradient headers, progress bars, weekly chart

### 6. Audio Engine Fix -- DONE (added post-design)
- ExpoAudioEngine rewritten with round-robin voice pools
- `replayAsync()` for atomic stop+play (no race conditions)
- 25 notes × 2 voices = 50 pre-loaded sound objects
- Dev Build created for physical device testing

### 7. Bug Fixes -- DONE (added post-design)
- 4 HIGH: MIDI noteOff double-counting, pause/resume reset, stale playedNotes closure, MIDI timestamp normalization
- 5 MEDIUM: streak bypass, exercise progress silent drop, practice time tracking, XP/level calculation, dead code
- Full changelog in `agent_docs/stabilization-report.md`

### 8. Gamification — Mascot & Transitions -- DONE (added post-design)
- Keysie mascot (MascotBubble) with 55 tips/facts, mood-based avatar
- ExerciseCard (quick slide-up between exercises, auto-dismiss)
- LessonCompleteScreen (full celebration with stats)
- AchievementToast (XP, level-up, streaks)
- ConfettiEffect for celebrations

### 9. MIDI Testing Documentation -- DONE (added post-design)
- `agent_docs/midi-integration.md` — complete guide
- VMPK installed, IAC Driver setup documented
- Native MIDI module deferred to RN 0.77+

## Non-Goals
- NOT copying Duolingo's exact design language
- NOT switching to MMKV (keep AsyncStorage)
- NOT Firebase sync (Phase 3)
- NOT microphone fallback (Phase 3)
- NOT native audio engine migration (deferred — RN 0.77+ needed for react-native-audio-api codegen)

## Technical Approach
- Parallel agent execution for independent work streams
- Test-driven for content validation
- Incremental commits per deliverable
- Bug hunt with comprehensive cross-module analysis
