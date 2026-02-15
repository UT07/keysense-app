# Feature: Duolingo-Style Level Map

## Status: IMPLEMENTED (Phase 2)

## Overview

Replace the current flat lesson list in LearnScreen with a vertical scrolling level map inspired by Duolingo's skill tree. Each lesson appears as a circular node connected by a path, with visual progression from bottom to top.

## Visual Design

```
       ★ Lesson 6: Popular Songs
       |
   ★ Lesson 5: Scales & Technique
       |
   ★ Lesson 4: Both Hands Together
       |
   ★ Lesson 3: Left Hand Basics        <-- locked (dimmed)
       |
   ● Lesson 2: Right Hand Melodies     <-- current (pulsing)
       |
   ✓ Lesson 1: Getting Started         <-- completed (gold)
```

## Node States

| State | Visual | Interaction |
|-------|--------|-------------|
| Completed (3 stars) | Gold circle with crown icon | Tap to replay, shows best score |
| Completed (1-2 stars) | Green circle with star count | Tap to replay or improve |
| Current/Available | Pulsing blue circle, larger | Tap to start next exercise |
| Locked | Grey circle with lock icon | Tap shows "Complete X to unlock" |

## Key Components

### LevelMapScreen (replaces LearnScreen)
- `ScrollView` with `inverted` layout (start at bottom)
- Auto-scrolls to current lesson on mount
- Lesson nodes connected by an SVG/canvas path line

### LessonNode
- Circular button (60-80px diameter)
- Shows: lesson icon, star count, completion ring
- Tap: navigates to next uncompleted exercise (or first if replaying)
- Long-press: shows lesson details tooltip

### PathConnector
- Curved SVG path between nodes
- Completed segments: solid gold
- Upcoming segments: dashed grey
- Small decorative elements along the path (music notes, etc.)

### LessonDetailSheet
- Bottom sheet on node tap (for completed lessons)
- Shows: title, description, exercise list with individual scores
- "Practice Again" button for each exercise
- "Review Lesson" button to replay all exercises

## Data Requirements

All data already exists in the stores:
- `lessonProgress[lessonId].status` — locked/available/in_progress/completed
- `lessonProgress[lessonId].exerciseScores` — per-exercise scores with stars
- `getLessons()` from ContentLoader — ordered lesson list
- `getLessonExercises(lessonId)` — exercises within each lesson

## Animations

- **Completion celebration**: Stars fly out when a lesson is completed
- **Node pulse**: Current available node has a gentle pulse animation
- **Path fill**: When completing a lesson, the path segment fills from bottom to top
- **Unlock**: New node unlocks with a scale-up + particle effect

## Implementation Notes

- Use `react-native-svg` for the connecting path lines
- Use `react-native-reanimated` for node pulse and celebration animations
- Consider `FlatList` with `inverted` for performance with many lessons
- Path curves should use quadratic bezier for smooth S-curves between nodes
- Responsive: nodes should zigzag left-right on wider screens

## Dependencies

- `react-native-svg` (may already be installed via Expo)
- No new backend/API changes needed

## Implementation Status

The LevelMapScreen has been implemented and replaced LearnScreen in the main tab navigation. It renders lesson nodes with correct states (completed/current/locked), auto-scrolls to current lesson, and navigates to the first uncompleted exercise on tap. See `src/screens/LevelMapScreen.tsx`.
