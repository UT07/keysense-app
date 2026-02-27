# UX Overhaul: HomeScreen, Free Play, Skill Tests, Assessment Fix

**Date:** February 27, 2026
**Status:** APPROVED
**Scope:** 4 batches — bug fixes, HomeScreen redesign, skill mastery tests, Free Play redesign, docs update

---

## Problems

1. **Assessment → Lesson Mismatch:** SkillAssessmentScreen determines `startLesson = "lesson-03"` but only seeds 3 foundational skills (`find-middle-c`, `keyboard-geography`, `white-keys`). Lesson 3 requires `rh-cde` + `rh-cdefg` which are never seeded. LevelMap shows user starting at tier 1 instead of tier 3.

2. **No Skill Mastery Tests:** Skills auto-master silently via `completionCount >= requiredCompletions`. No explicit test UI exists to prove mastery before advancing. No spaced review challenges when skills decay.

3. **HomeScreen Outdated:** Music Library (124 songs, 6 genres) has zero visibility on the home dashboard. "Continue Learning" is buried below Salsa coach, daily rewards, and daily challenge. Quick Actions are generic and don't highlight Songs.

4. **Free Play Unpolished:** Landscape-only orientation is unnatural for phone. No music sheet reference. No two-hand split keyboard. Recording controls crammed into tiny top bar. Looks like a prototype.

5. **Docs Stale:** Master plan, CLAUDE.md, stabilization report don't reflect Phase 8 polyphonic completion or this UX overhaul.

---

## Batch 1: Assessment Fix + Skill Seeding

### Assessment Skill Seeding Fix

**File:** `src/screens/SkillAssessmentScreen.tsx`

When `determineStartLesson()` returns a lesson > 1, seed ALL prerequisite skills for that lesson and all lessons below it.

**Current seeding (buggy):**
```
avgScore >= 0.8 → seed [find-middle-c, keyboard-geography, white-keys]
avgScore >= 0.6 → seed [find-middle-c]
```

**Fixed seeding:**
```
startLesson = lesson-03 → seed all prereqs for lessons 1-3:
  - find-middle-c, keyboard-geography, white-keys (lesson-02 prereqs)
  - rh-cde, rh-cdefg (lesson-03 prereqs)

startLesson = lesson-04 → also seed:
  - c-position-review, lh-scale-descending, steady-bass

startLesson = lesson-05 → also seed:
  - both-hands-review
```

**Prereq map** (from `CurriculumEngine.shouldUnlockAnchorLesson`):
```typescript
const LESSON_PREREQS: Record<string, string[]> = {
  'lesson-01': [],
  'lesson-02': ['find-middle-c', 'keyboard-geography', 'white-keys'],
  'lesson-03': ['rh-cde', 'rh-cdefg'],
  'lesson-04': ['c-position-review', 'lh-scale-descending', 'steady-bass'],
  'lesson-05': ['both-hands-review'],
  'lesson-06': ['scale-review', 'both-hands-review'],
};
```

On assessment completion:
1. Determine `startLesson` from round scores
2. Collect ALL skills from lesson-01 through startLesson's prereqs
3. Call `markSkillMastered(skillId)` for each
4. Mark earlier lessons as completed in `progressStore`

### LevelMap Consistency

Ensure `useTierNodes()` correctly shows earlier tiers as completed when skills are seeded. The existing `areAllPrereqsMet()` logic should work once skills are properly seeded — verify with tests.

---

## Batch 2: Skill Mastery Tests

### A) End-of-Lesson Skill Test

**New screen:** `src/screens/SkillTestScreen.tsx`

**Trigger:** After user completes all exercises in a lesson, auto-navigate to SkillTestScreen instead of the normal completion screen.

**Design:**
- Header: "Skill Test: [Lesson Title]"
- 4-6 notes/phrases that test the lesson's key skills
- Uses ExercisePlayer internally (pass `isSkillTest: true` to differentiate UI)
- Scoring: Must score 70%+ to pass
- On pass: Mark lesson as mastered, show celebration, unlock next tier
- On fail: Show which skills need work, "Practice More" button returns to lesson exercises

**Exercise generation:** Build a skill test exercise dynamically from the lesson's skill nodes:
```typescript
function buildSkillTestExercise(lessonId: string): Exercise {
  const skillNodes = SKILL_TREE.filter(n =>
    n.targetExerciseIds.some(id => id.startsWith(lessonId))
  );
  // Generate a mini-exercise that tests each skill
  // Use generation hints from the skill nodes
  // Tempo: average of lesson exercises
  // Notes: sample from each skill's note patterns
}
```

**Integration points:**
- `ExercisePlayer` completion handler: check if all lesson exercises done → navigate to SkillTest
- `progressStore`: new `skillTestResults: Record<lessonId, { passed: boolean, score: number, attempts: number }>`
- `LevelMapScreen`: show skill test badge on lesson nodes (untested/passed/failed)

### B) Spaced Review Challenges

**Location:** HomeScreen (in new feed-style layout) + DailySessionScreen

**Trigger:** When `calculateDecayedSkills()` returns skills with decay < 0.5

**Design:**
- "Review Challenge" card appears on HomeScreen between Continue Learning and Daily Challenge
- Shows: "3 skills need review" with skill names
- Tapping loads a quick 3-exercise review sequence
- Uses existing `CurriculumEngine.generateSessionPlan('review')` logic
- Completing refreshes `lastPracticedAt` and resets decay score

**New component:** `ReviewChallengeCard.tsx`
```
┌─────────────────────────────┐
│ 🔄 Skills Need Review       │
│ rh-cde • white-keys • ...   │
│ 3 skills decaying           │
│ [Start Review →]            │
└─────────────────────────────┘
```

---

## Batch 3: HomeScreen Redesign (Feed-Style)

### Layout (top to bottom)

1. **Compact Hero Section**
   - Greeting + display name (left)
   - Gem counter + settings gear (right)
   - Cat avatar in goal arc ring (centered, smaller than current)
   - Streak/Level/XP pills row
   - Evolution progress bar
   - Daily goal progress text

2. **Music Library Spotlight Card** ← NEW, most prominent
   ```
   ┌─────────────────────────────────┐
   │  ♫  MUSIC LIBRARY               │
   │  124 Songs • 6 Genres           │
   │  ┌─────────────────────────┐    │
   │  │ 🎵 Featured: Moonlight  │    │
   │  │    Sonata (Beethoven)    │    │
   │  │    Classical • ★★★☆☆    │    │
   │  └─────────────────────────┘    │
   │  [Browse Library →]             │
   └─────────────────────────────────┘
   ```
   - Gradient background (purple→blue or warm tones)
   - Shows a random/featured song each day
   - Genre pill chips below
   - "Browse Library" CTA navigates to Songs tab

3. **Continue Learning Card** (existing, but below Music Library)
   - Play icon + next exercise title + lesson label
   - Progress bar + percentage
   - Navigates to the correct lesson from assessment

4. **Review Challenge Card** ← NEW (conditional, only when skills decaying)

5. **Salsa Coach** (existing, compact)

6. **Daily Challenge Card** (existing)

7. **Stats Row** (existing)

8. **Quick Actions Grid** — Modified:
   - Replace "Practice" with **"Songs"** (music note icon, navigates to Songs tab)
   - Keep: Learn, Free Play, Collection
   - Songs card gets the gradient highlight (was on Learn)

### Remove from HomeScreen
- Daily Reward Calendar (move to Profile tab — it's secondary)
- Weekly/Monthly Challenge cards (fold into Daily Challenge as expandable)

---

## Batch 4: Free Play Redesign

### Orientation Change
- **Portrait mode** (remove landscape lock)
- Full-screen stack screen (already is)

### Layout (top to bottom)

```
┌─────────────────────────────┐
│ ← Free Play    🎤 MIDI  ⚙️  │  ← Header: back, title, input badge, settings
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │    C4  D4  E4  F4  G4   │ │  ← Note reference / song sheet area (40%)
│ │    ♩   ♩   ♩   ♩   ♩    │ │     Shows note names or loaded song
│ │                         │ │
│ │  "Twinkle Twinkle..."   │ │     If song loaded: scrolling note guide
│ │   C C G G A A G         │ │     If no song: simple note name display
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │  RIGHT HAND (C4-C6)     │ │  ← Upper keyboard (right hand)
│ │  [Piano keys]            │ │     2 octaves
│ ├─────────────────────────┤ │
│ │  LEFT HAND (C2-C4)      │ │  ← Lower keyboard (left hand)
│ │  [Piano keys]            │ │     2 octaves
│ └─────────────────────────┘ │
├─────────────────────────────┤
│  ⏺ Record  ▶ Play  🗑 Clear │  ← Floating action bar
│  12 notes • Key of C major  │     Stats + analysis
└─────────────────────────────┘
```

### Song Reference Integration
- **"Load Song" button** in header opens a picker modal
- Lists songs from songStore (cached locally)
- Selected song's melody notes display as scrolling note names in the reference panel
- Color-coded: upcoming notes grey, current note highlighted, played notes green
- This gives Free Play a real purpose: practice songs without scoring pressure

### Split Keyboard
- Use existing `SplitKeyboard` component (already exists at `src/components/Keyboard/SplitKeyboard.tsx`)
- Left hand: C2-B3 (2 octaves)
- Right hand: C4-C6 (2 octaves)
- Both respond to touch simultaneously

### Controls
- Floating action bar at bottom (not in header)
- Record / Play / Clear buttons with proper icons
- Session stats: note count, detected key
- Analysis card appears as an overlay after 2s silence (keep existing logic)

---

## Batch 5: Docs Update

### CLAUDE.md Updates
- Test counts: 106 suites → updated count after new tests
- Phase 8: Mark polyphonic detection complete
- Add Phase 8.5/9.5: UX Overhaul (this work)
- Update "Up Next" section
- Add new files to key files table (SkillTestScreen, ReviewChallengeCard)

### Master Plan Updates
- Phase 8: Update to include polyphonic completion (Feb 26)
- Add new section: "Phase 9.5: UX Overhaul" with this work
- Update timeline
- Update codebase health metrics
- Update execution priority

### Stabilization Report
- Add entries for assessment fix, skill tests, HomeScreen redesign, Free Play redesign

---

## Implementation Order

```
Batch 1: Assessment Fix + Skill Seeding     (~2-3 files, pure logic)
Batch 2: Skill Mastery Tests                 (~4-5 new files)
Batch 3: HomeScreen Redesign                 (~1 file heavy rewrite + 2 new components)
Batch 4: Free Play Redesign                  (~1 file heavy rewrite)
Batch 5: Docs Update                         (~3-4 doc files)
```

Each batch is independently testable and shippable.

---

## Test Plan

- **Batch 1:** Unit test `determineStartLesson` + skill seeding for all lesson levels. Verify LevelMap shows correct tier.
- **Batch 2:** Unit test skill test exercise generation. Integration test: complete lesson → skill test → unlock.
- **Batch 3:** Snapshot/render test for new HomeScreen layout. Verify Music Library card navigation.
- **Batch 4:** Render test for portrait Free Play. Test song loading from store. Test split keyboard.
- **Batch 5:** Verify docs accuracy against codebase.
