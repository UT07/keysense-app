# Phase 2 Completion: Gamification Polish & Keysie Avatar

**Date:** 2026-02-15
**Status:** Design approved
**Scope:** Close out Phase 2 with avatar upgrade, visual polish, interaction refinements, and onboarding verification

---

## 1. Keysie Avatar Upgrade

### Problem
Current mascot is a single emoji (🎹/🎵) in a colored circle. No personality, no brand identity, no interactivity. Compared to Duolingo's owl, it's not even close.

### Solution: SVG Cat with Reanimated Animations

**Character design:** A music-themed cat (the user has 3 cats!) with:
- Headphones resting on ears
- Piano-key pattern collar/bowtie
- Music note-shaped tail tip (eighth note curl)
- Expressive eyes, ears, and whiskers
- Color palette: dark grey body (#2A2A2A), crimson accents (#DC143C), gold highlights (#FFD700)

**Mood states (5 poses via SVG + Reanimated):**

| Mood | Expression | Animation |
|------|-----------|-----------|
| `idle` | Relaxed, soft smile, eyes open | Gentle breathing (scale pulse 1.0-1.02), ear twitch every 3s |
| `celebrating` | Wide grin, sparkle eyes, paws up | Bounce up/down, star particles around head |
| `encouraging` | Warm smile, one paw giving thumbs-up | Nod animation, paw wave |
| `teaching` | Curious head tilt, one ear up | Head tilt side-to-side, pointing gesture |
| `sad` | Droopy ears, slight frown → perks up | Ears droop then spring back up after 1s |

**Component architecture:**
```
src/components/Mascot/
├── KeysieAvatar.tsx      — Main component (SVG + Reanimated)
├── KeysieSvg.tsx          — Raw SVG paths for the cat
├── MascotBubble.tsx       — Speech bubble (refactored to use KeysieAvatar)
├── mascotTips.ts          — 55 tips (existing, unchanged)
└── types.ts               — Shared types
```

**KeysieAvatar props:**
```typescript
interface KeysieAvatarProps {
  mood: MascotMood;
  size: 'tiny' | 'small' | 'medium' | 'large';  // 24, 40, 56, 80px
  animated?: boolean;  // default true
  showParticles?: boolean;  // for celebrating mood
}
```

**Sizes:**
- `tiny` (24px) — inline in text, toasts
- `small` (40px) — level map nodes, exercise cards
- `medium` (56px) — completion modal, home screen
- `large` (80px) — onboarding, lesson complete

### Keysie Placement (6 integration points)

1. **Level Map (current node)** — Small Keysie sits on the active lesson node with idle animation + rotating tip bubble
2. **ExerciseCard (between exercises)** — Medium Keysie with mood matching score (celebrating >90%, encouraging 70-90%, teaching <70%)
3. **CompletionModal** — Medium Keysie with extended animation (celebrating/encouraging) + AI coach speech bubble
4. **LessonCompleteScreen** — Large Keysie celebrating alongside trophy
5. **HomeScreen header** — Small Keysie next to greeting text, idle animation
6. **Onboarding screens** — Large Keysie teaching, guiding each step

### Future: Lottie Upgrade Path
- `KeysieAvatar` accepts an optional `lottieSource` prop
- When Lottie files exist, they override SVG rendering
- Same mood API, just richer animations
- No other code changes needed

---

## 2. Visual Polish

### A. Gradient Headers
**Screens:** HomeScreen, ProfileScreen, LevelMapScreen header
- Replace flat `#1A1A1A` backgrounds with `LinearGradient`
- Gradient: `['#1A1A1A', '#141414', '#0D0D0D']` top-to-bottom
- Subtle, professional — not flashy

### B. Card System Refinement
**All card components** (HomeScreen cards, ExerciseCard, ProfileScreen stats):
- Consistent shadow: `shadowColor: '#000', shadowOffset: {0, 4}, shadowOpacity: 0.3, shadowRadius: 8`
- Border: `1px solid #2A2A2A` (existing) with hover-state border glow
- Border radius: standardize to 16px across all cards

### C. Score Ring Animation
**ExerciseCard + CompletionModal:**
- Replace static colored border with animated SVG ring fill
- Ring fills clockwise from 0° to `score%` over 800ms with easing
- Color transitions: red (<60) → orange (60-79) → green (80-94) → gold (95+)
- Inner text scales in slightly delayed (200ms after ring starts)

### D. Level Map Path Animation
- When completing a lesson, the SVG path segment fills from bottom node to top node
- Gold color fills over 600ms with easing
- New node unlocks with scale-up bounce (0.5 → 1.1 → 1.0)

---

## 3. Interaction Polish

### A. Button Press Feedback
**All TouchableOpacity instances:**
- `activeOpacity={0.8}` (standardize — currently varies)
- Add `Pressable` with scale animation where needed:
  - Press: scale to 0.97 over 80ms
  - Release: scale to 1.0 over 120ms (spring)
- Primary buttons (crimson): slight brightness increase on press

### B. Screen Transitions
- Tab transitions: cross-fade (150ms) instead of instant swap
- Stack push: slide-from-right (default React Navigation, already working)
- Modal: slide-from-bottom with dimmed backdrop

### C. Loading & Empty States
- **Skeleton loading:** Shimmer placeholders for HomeScreen cards during hydration
- **Empty streak:** Keysie encouraging "Start your streak today!" instead of "0 days"
- **No exercises completed:** Keysie teaching "Let's play your first note!"

### D. Keyboard Visual Upgrade
- White keys: subtle top-to-bottom gradient (`#FFFFFF` → `#F0F0F0`)
- Black keys: slight sheen gradient (`#1A1A1A` → `#2A2A2A`)
- Pressed state: deeper shadow, slight color shift
- Expected note highlight: pulsing glow instead of static green border

---

## 4. Onboarding Flow Verification

### Current State
- 4 screens: Welcome, Experience, Equipment, Goal
- `hasCompletedOnboarding` persisted in settingsStore
- Navigation: Onboarding → MainTabs

### Verification Checklist
1. Fresh install → Onboarding shows (not MainTabs)
2. Each step navigable (Next/Skip/Back)
3. Experience level saved → affects initial difficulty suggestions
4. Equipment selection (screen keyboard vs MIDI) persisted
5. Daily goal selection works
6. Completion → `hasCompletedOnboarding = true` → MainTabs
7. Subsequent launches → skip onboarding

### Keysie in Onboarding
- Welcome: Large Keysie celebrating, "Hi! I'm Keysie!"
- Experience: Keysie teaching, "Everyone starts somewhere!"
- Equipment: Keysie curious (teaching), head tilt
- Goal: Keysie encouraging, "Great choice!"

---

## 5. Scope & Priority Order

### Must-Have (Phase 2 Close)
1. **Keysie SVG avatar** — 5 moods, 4 sizes, animated
2. **Keysie integration** — Level Map + ExerciseCard + CompletionModal + Home
3. **Score ring animation** — Animated SVG circle fill
4. **Gradient headers** — HomeScreen, ProfileScreen, LevelMap
5. **Onboarding E2E verification** — Fresh install flow works

### Nice-to-Have (if time allows)
6. Button press feedback (scale animations)
7. Keyboard visual gradient
8. Level Map path fill animation
9. Empty/loading states with Keysie
10. Keysie in onboarding screens

### Explicitly Deferred
- Adaptive Learning System → separate design doc exists
- Lottie animation files → future upgrade path
- Community features → Phase 3
- Leagues/leaderboards → Phase 3/4

---

## 6. Technical Notes

### Dependencies
- `lottie-react-native` — install now for future Lottie path (optional, can defer)
- `react-native-svg` — already installed (used by LevelMapScreen)
- `react-native-reanimated` — already installed
- `expo-linear-gradient` — already installed

### Testing
- Snapshot tests for KeysieAvatar (5 moods × 4 sizes)
- Integration test: MascotBubble renders with new avatar
- Onboarding E2E: fresh state → completion → main tabs
- Visual regression: screenshot comparison before/after polish

### File Changes Estimate
- New files: 2-3 (KeysieAvatar, KeysieSvg, types)
- Modified files: ~10 (MascotBubble, ExerciseCard, CompletionModal, LessonCompleteScreen, HomeScreen, LevelMapScreen, ProfileScreen, OnboardingScreen, Keyboard components)
