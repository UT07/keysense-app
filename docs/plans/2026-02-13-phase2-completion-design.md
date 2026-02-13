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

### 2. Lessons 2-6 E2E Testing
- Validate all 31 exercises load and score correctly
- Fix content issues (missing IDs, broken scoring configs)
- Add ContentLoader tests for lessons 2-6
- Ensure lesson unlock flow works across all 6 lessons

### 3. Level Map UI (replaces LearnScreen)
- Vertical scrolling map with lesson nodes connected by paths
- Node states: completed (green), current (pulsing), locked (grey)
- Auto-scroll to current lesson on mount
- Tap to navigate to first uncompleted exercise
- Uses: FlatList inverted, react-native-svg, Animated API
- Data: ContentLoader.getLessons() + progressStore.lessonProgress

### 4. Onboarding Flow
- 4 screens: Welcome, Experience Level, Equipment Check, Daily Goal
- Persisted via settingsStore.hasCompletedOnboarding
- Navigates to first exercise on completion
- Currently hardcoded to skip -- make functional

### 5. UI Polish (Own Identity)
- Keep Material palette, add distinctive gradients/shadows
- Typography hierarchy improvements
- Micro-animation polish
- Update docs to match current implementation

## Non-Goals
- NOT copying Duolingo's exact design language
- NOT switching to MMKV (keep AsyncStorage)
- NOT building mascot character
- NOT Firebase sync (Phase 3)
- NOT microphone fallback (Phase 3)

## Technical Approach
- Parallel agent execution for independent work streams
- Test-driven for content validation
- Incremental commits per deliverable
