# Gamification & Adaptive Learning Overhaul — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Transform Purrrfect Keys from a structured lesson app into a personalized, AI-driven piano learning experience with Duolingo-level visual polish, living cat companions, AI-generated exercises for every user, and two-handed keyboard support.

**Last Updated:** February 16, 2026

---

## 1. Cat Companion System

### 1.1 Cat Dialogue Engine

Each of the 8 cats gets a distinct personality expressed through ~40 dialogue lines each (~320 total). Dialogue triggers at key moments throughout the app.

**Personality archetypes:**
| Cat | Personality | Voice Style |
|-----|------------|-------------|
| Mini Meowww | Eager beginner | "Ooh ooh, let's try that again!" |
| Jazzy | Cool & smooth | "Nice groove, keep that rhythm flowin'" |
| Chonky Monké | Laid-back comedian | "Eh, close enough... just kidding, nailed it!" |
| Luna | Mystical & wise | "The melody speaks through you..." |
| Biscuit | Warm encourager | "You're doing amazing, sweetie!" |
| Vinyl | Retro music nerd | "That had real vinyl warmth to it" |
| Aria | Dramatic perfectionist | "Magnificent! Encore! ENCORE!" |
| Tempo | Strict metronome | "Timing was 3ms off. Let's fix that." |

**Dialogue trigger points:**
- Exercise start (encouragement)
- Mid-exercise (react to performance — great streak, missed note, combo)
- Exercise complete (celebrate/coach based on score)
- Level up (unique celebration per cat)
- Daily login (greeting based on time of day + streak)
- Idle (cat gets bored/sleepy if no input for 30s)
- AI exercise introduction ("I picked this one just for you!")
- Achievement unlock (cat-specific congratulations)

**Data structure:**
```typescript
interface CatDialogue {
  catId: string;
  trigger: DialogueTrigger;
  condition?: 'score_high' | 'score_low' | 'streak' | 'first_try' | 'retry';
  messages: string[]; // Random selection from pool
}

type DialogueTrigger =
  | 'exercise_start' | 'exercise_mid_great' | 'exercise_mid_miss'
  | 'exercise_complete_pass' | 'exercise_complete_fail'
  | 'level_up' | 'daily_login' | 'idle'
  | 'ai_exercise_intro' | 'achievement_unlock';
```

**File:** `src/content/catDialogue.ts` — flat lookup by `catId + trigger + condition`

### 1.2 Cat Presence Everywhere

- **HomeScreen:** Selected cat visible with mood indicator (happy/neutral/sleepy)
- **ExercisePlayer:** Cat avatar in corner, reacts to hits/misses with micro-animations
- **CompletionModal:** Cat delivers the coaching message (replaces generic text)
- **LessonIntro:** Cat introduces the lesson with personality
- **ProfileScreen:** Cat shown large with dialogue bubble

### 1.3 Cat Mood Engine

Mood = f(practice recency, session performance, streak)

```
happy:   practiced today AND (score > 70% OR streak >= 3)
neutral: practiced in last 48h
sleepy:  no practice in 48h+
```

Mood affects dialogue selection — sleepy cat gives "I missed you!" messages, happy cat is enthusiastic.

### 1.4 Cat Unlock Reveals

When a user reaches the required level for a new cat:
- Full-screen reveal animation (cat appears with sparkle effect)
- Cat introduces itself with personality dialogue
- Option to switch to new cat immediately

---

## 2. Adaptive Learning System (Gemini AI)

### 2.1 Entry Skill Assessment

During onboarding (after account creation, before first lesson):

1. "Let's see where you're at!" — cat introduces the test
2. Play 5-8 notes at increasing difficulty:
   - Round 1: Single notes, slow tempo (quarter notes at 60 BPM)
   - Round 2: Two-note sequences, moderate tempo
   - Round 3: Simple chord (C major)
   - Round 4: Faster sequence with sharps/flats
   - Round 5: Syncopated rhythm
3. Measure: timing accuracy, pitch accuracy, response speed
4. Result → starting lesson (skip basics for experienced players) + initial learner profile

**Skip rules:**
- Rounds 1-2 perfect → skip Lessons 1-2
- Rounds 1-3 perfect → skip Lessons 1-4
- All rounds perfect → skip to post-curriculum AI exercises
- Any round failed → start from that difficulty level

### 2.2 Learner Profile

Persisted in Zustand + synced to Firestore:

```typescript
interface LearnerProfile {
  // Per-note accuracy (rolling average of last 20 attempts)
  noteAccuracy: Record<number, number>; // MIDI note → 0.0-1.0

  // Skill dimensions
  skills: {
    timingAccuracy: number;   // 0.0-1.0
    pitchAccuracy: number;    // 0.0-1.0
    sightReadSpeed: number;   // notes per minute
    chordRecognition: number; // 0.0-1.0
  };

  // Tempo comfort zone
  tempoRange: { min: number; max: number }; // BPM

  // Weak areas (auto-calculated)
  weakNotes: number[];      // MIDI notes below 70% accuracy
  weakSkills: string[];     // Skills below 60%

  // History
  totalExercisesCompleted: number;
  lastAssessmentDate: string;
}
```

Updated after every exercise completion.

### 2.3 AI Exercise Generation (Gemini Flash)

**Architecture:**

```
User completes exercise
  → Score updates LearnerProfile
  → Background: check exercise buffer
  → If buffer < 3: call Gemini to generate 3 exercises
  → Cache in AsyncStorage
  → Next exercise loads instantly from buffer
```

**Gemini prompt template:**
```
Generate a piano exercise as JSON for a student with this profile:
- Weak notes: {weakNotes}
- Timing accuracy: {timingAccuracy}
- Comfortable tempo range: {tempoRange}
- Current skill focus: {weakestSkill}
- Difficulty: {targetDifficulty}

Requirements:
- {noteCount} notes
- Tempo: {targetTempo} BPM
- Time signature: 4/4
- Notes must be within MIDI range {rangeMin}-{rangeMax}
- Focus on these specific notes: {weakNotes}
- Include at least one {weakestSkill} challenge

Return valid JSON matching this schema:
{exerciseSchema}
```

**Validation layer** (runs on every AI response before caching):
- All notes within playable MIDI range (36-96)
- Rhythm adds up correctly per measure
- No impossible intervals (>octave at tempo >120 BPM)
- Tempo within learner's range ±20%
- Key signature consistency
- If validation fails → regenerate (max 2 retries) → fallback to template

**Buffer management:**
- Target: always 3-5 exercises cached ahead
- Generate in batches of 3 (one Gemini call)
- Evict old cached exercises after 50 (FIFO)
- On app launch: check buffer, top up if needed

### 2.4 Difficulty Curve ("Flow Zone")

Target: keep user between 65-85% success rate (optimal learning zone).

```
After each exercise:
  score > 85% → increase difficulty
    - Tempo +5 BPM
    - Add 1-2 notes
    - Introduce sharps/flats if not present

  score 65-85% → maintain (flow zone)
    - Vary note patterns but keep difficulty

  score < 65% → decrease difficulty
    - Tempo -10 BPM
    - Simplify rhythm
    - Remove accidentals
    - Shorter exercise (fewer notes)
```

### 2.5 Offline Fallback

- 30 template exercises per difficulty tier (easy/medium/hard) = 90 templates
- Template selection uses learner profile (pick templates targeting weak notes)
- Swap specific notes in templates based on weak-note queue
- User never sees a difference

### 2.6 Curriculum vs. AI Exercises

| Aspect | Lessons 1-6 (Hand-crafted) | Post-curriculum (AI) |
|--------|---------------------------|---------------------|
| Content | Fixed, curated exercises | Gemini-generated |
| Purpose | Teach fundamentals | Personalized practice |
| Offline | Always available | Cached buffer + templates |
| Progression | Linear (lesson order) | Adaptive (learner profile) |
| Hints | Green note highlights | Optional (user toggle) |
| Cat role | Introduces concepts | Coaches on weak areas |

---

## 3. Keyboard Redesign

### 3.1 Auto-Scroll (Both Modes)

The existing `focusNote` → `ScrollView.scrollTo()` mechanism already works. Enhancements:

**Normal mode (single keyboard):**
- `focusNote` updates to the next expected note as each note is consumed
- When consecutive notes are far apart (>1 octave), scroll animation starts early (as user plays current note)
- Keyboard width: 2-4 octaves depending on exercise range

**Split mode (two keyboards):**
- Each keyboard half has its own `focusNote`
- Left hand `focusNote` = next expected note below split point
- Right hand `focusNote` = next expected note above split point
- Each half scrolls independently

**Scroll behavior:**
- `animated: true` with smooth scroll
- `scrollEnabled={false}` during exercises (no manual drag)
- Only scroll if target note is outside visible area (avoid unnecessary movement)

### 3.2 Split Keyboard Mode

Activated when exercise has `hands: 'both'` or notes span >3 octaves.

**Layout:**
```
┌─────────────────────────────────┐
│  PianoRoll (right hand notes)   │
│  ░░░░▓▓░░░░▓▓░░░░▓▓░░░░░░░░░  │
├─────────────────────────────────┤
│  Right Hand Keyboard (1.5 oct)  │
│  │C│D│E│F│G│A│B│C│D│E│F│G│A│   │
├─────────────────────────────────┤
│  Left Hand Keyboard (1.5 oct)   │
│  │C│D│E│F│G│A│B│C│D│E│F│G│A│   │
├─────────────────────────────────┤
│  PianoRoll (left hand notes)    │
│  ░░░▓▓░░░░▓▓░░░░░░░░░░░░░░░░  │
└─────────────────────────────────┘
```

**Implementation:**
- Two `<Keyboard>` instances, each with own `startNote`, `octaveCount`, `focusNote`
- Two `<PianoRoll>` instances, each showing notes for one hand
- Split point defined in exercise JSON (`splitPoint: 60` = middle C)
- Each keyboard has its own touch responder (independent multi-touch)
- Smaller keys: `keyHeight: 55` (vs 80 in normal mode) to fit both

**Exercise JSON extension:**
```json
{
  "hands": "both",
  "splitPoint": 60,
  "notes": [
    { "midi": 48, "startBeat": 0, "duration": 1, "hand": "left" },
    { "midi": 64, "startBeat": 0, "duration": 1, "hand": "right" }
  ]
}
```

### 3.3 Normal Mode (Single Keyboard)

Kept for all single-hand exercises and exercises where notes fit in 2 octaves:
- Full-width keyboard, `keyHeight: 80`
- Auto-scroll via `focusNote`
- `scrollEnabled={false}` during exercise play
- Existing multi-touch responder system

**Auto-selection logic:**
```typescript
function getKeyboardMode(exercise: Exercise): 'normal' | 'split' {
  if (exercise.hands === 'both') return 'split';
  const range = maxNote - minNote;
  if (range > 36) return 'split'; // >3 octaves
  return 'normal';
}
```

---

## 4. Gamification Overhaul

### 4.1 Daily Engagement Loop

**Daily Challenge:**
- One AI-generated exercise targeting the user's weakest area
- Refreshes at midnight local time
- Bonus XP reward (2x normal)
- Cat introduces it: "I found something special for you today!"
- Shown prominently on HomeScreen

**Streak System:**
- Consecutive days with at least 1 exercise completed
- Streak counter visible on HomeScreen with fire animation
- Milestones: 3, 7, 14, 30, 60, 100 days
- Cat reacts to streak milestones with unique dialogue
- Streak freeze: 1 free freeze per week (recover from missed day)

**Daily XP Goal:**
- Target: 50 XP/day (adjustable in settings)
- Progress ring on HomeScreen around cat avatar
- Cat mood tied to daily goal completion

### 4.2 Achievement Expansion (10 → 30+)

**Cat-themed:**
- "Cat Whisperer" — Unlock 3 cats
- "Full Orchestra" — Unlock all 8 cats
- "Best Friends" — Play 100 exercises with one cat selected
- "Cat Collector" — View all cat unlock animations

**Skill-based:**
- "Perfect Pitch" — 100% accuracy on any exercise
- "Speed Demon" — Pass an exercise at 150+ BPM
- "Sight Reader" — Complete 10 AI exercises first-try
- "Chord Master" — Perfect score on a chord exercise
- "Marathon" — Play 20 exercises in one session

**Adaptive:**
- "Comeback Kid" — Improve a weak note accuracy by 30%
- "Flow Master" — 5 consecutive exercises in flow zone (65-85%)
- "Weak No More" — Clear all notes from weak-note queue
- "Level Up Learner" — Complete skill assessment with higher score than initial

**Streaks & Consistency:**
- "Week Warrior" — 7-day streak
- "Monthly Master" — 30-day streak
- "Century" — 100-day streak
- "Early Bird" — Practice before 8am
- "Night Owl" — Practice after 10pm

**Social prep (Phase 5):**
- "First Share" — Share a score
- "Duet Partner" — Play with a friend

### 4.3 Cat-Driven Motivation

- Cats give "quests" based on learner profile: "Hey! Try playing F# major today!"
- Each cat has a "signature exercise" unlocked when selected — short, themed piece that matches their personality
- Cat celebration animations on level-up (unique per cat)
- Cat reacts in real-time during exercises (micro-expressions on hits/misses)

### 4.4 Leaderboard Prep

Data structure implemented now, UI in Phase 5:
- Weekly XP totals stored in Firestore
- Anonymous leaderboard data (no social features yet)
- `weeklyXp` field in user document, reset on Monday

---

## 5. UI Overhaul — Duolingo-Level Polish

### 5.1 Design Philosophy

Transform every screen from "functional dark theme" to "vibrant, reward-dopamine-loop" that college students actually want to open daily. Inspired by Duolingo's design language: bold colors, playful animations, clear visual hierarchy, celebration at every turn.

**Current:** Dark concert hall theme (#0D0D0D bg, #1A1A1A surface, crimson accents)
**Target:** Keep the dark base but inject life — gradients, glow effects, animated transitions, card depth, micro-interactions

### 5.2 HomeScreen Redesign

**Hero Section (top 40% of screen):**
- Large animated cat avatar (selected cat) with mood-driven idle animation
- XP progress ring around cat (like Duolingo's crown)
- Streak flame badge with counter (animated flicker)
- Daily goal progress arc below cat
- Gradient background: deep purple (#1A0A2E) → dark (#0D0D0D)

**Daily Challenge Card:**
- Full-width card with gradient border (animated shimmer)
- Cat speech bubble introducing the challenge
- "2x XP" badge in corner
- Timer showing hours until refresh

**Continue Learning Section:**
- Large rounded card with lesson progress bar
- Exercise thumbnail preview (mini piano roll)
- "Continue" button with crimson gradient + arrow

**Quick Stats Row:**
- 4 compact stat pills: Level, XP Today, Streak, Exercises Done
- Each pill has icon + number + subtle glow matching stat color

### 5.3 Level Map Redesign

**Path style:** Duolingo-style vertical path with:
- Circular lesson nodes on a winding road (not zigzag lines)
- Nodes are large (80px) with clear state colors
- Completed: gold fill + check + 3 stars below
- Current: crimson fill + pulsing glow ring + "START" label
- Locked: grey fill + lock icon + "Level X" requirement
- Decorative elements between nodes (music notes, cat paw prints)
- Background: subtle parallax scroll with floating musical elements

**Lesson Node Press:**
- Expand animation (node grows + info card slides up)
- Shows: title, exercise count, XP reward, difficulty stars
- "Start" button with haptic feedback

### 5.4 Exercise Player UI Refresh

**Score Display:**
- Floating combo counter with bounce animation (Duolingo-style "+10 XP" popups)
- Progress bar at top showing exercise completion %
- Real-time accuracy indicator (color-coded ring)

**Completion Celebration:**
- Full-screen confetti for 3 stars (react-native-reanimated particles)
- Cat jumps/dances with unique animation
- Score counter animates up from 0
- Stars light up one by one with sound effect
- XP earned flies into the XP counter

### 5.5 Profile Screen Glow-Up

**Header:**
- Large cat avatar with animated background (cat's theme color gradient)
- Username with editable badge
- Level badge: circular with level number + progress ring

**Stats Grid:**
- 2x2 cards with icon, number, label
- Each card has subtle gradient matching stat type
- Animated number counters on screen enter

**Achievement Showcase:**
- Horizontal scrollable row of recent achievements (shiny badges)
- "View All" expands to full grid
- Locked achievements: silhouette with "?" — tap shows requirements
- Newly unlocked: glow animation for 24 hours

### 5.6 Onboarding Polish

**Visual improvements:**
- Animated transitions between steps (slide + fade)
- Cat avatar guides through each step (different cat for each step)
- Skill assessment: animated piano keys light up as user plays
- Progress dots → animated progress bar with cat walking along it

### 5.7 Shared Design Tokens

**New color palette additions (alongside existing dark theme):**
```typescript
const COLORS = {
  // Existing
  background: '#0D0D0D',
  surface: '#1A1A1A',
  primary: '#DC143C',

  // New accent gradients
  gradientPurple: ['#1A0A2E', '#2D1B4E'],
  gradientGold: ['#FFD700', '#FFA500'],
  gradientSuccess: ['#4CAF50', '#2E7D32'],

  // Glow effects
  glowCrimson: 'rgba(220, 20, 60, 0.3)',
  glowGold: 'rgba(255, 215, 0, 0.3)',
  glowPurple: 'rgba(138, 43, 226, 0.3)',

  // Card surfaces (elevated)
  cardSurface: '#242424',
  cardBorder: '#333333',
  cardHighlight: '#2A2A2A',

  // Text hierarchy
  textPrimary: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textMuted: '#666666',
  textAccent: '#DC143C',
};
```

**Animation constants:**
```typescript
const ANIMATION = {
  springConfig: { damping: 15, stiffness: 150 },
  bounceConfig: { damping: 8, stiffness: 200 },
  fadeIn: { duration: 300 },
  slideUp: { duration: 400, easing: Easing.out(Easing.cubic) },
  celebrationDuration: 2000,
};
```

### 5.8 Micro-Interactions (Everywhere)

- **Button press:** Scale 0.95 + haptic (already have PressableScale)
- **Card enter viewport:** Fade up with stagger (100ms between cards)
- **XP earned:** Number flies up and fades (+10 XP popup)
- **Level up:** Full-screen celebration with cat + confetti
- **Achievement unlock:** Toast slides down with shine animation
- **Streak milestone:** Fire animation intensifies + cat celebration
- **Tab switch:** Crossfade with slight slide
- **Pull to refresh:** Cat stretches animation

---

## 6. Implementation Scope

| Component | New Files | Modified Files | Estimated Effort |
|-----------|-----------|---------------|-----------------|
| Cat Dialogue System | ~3 | ~5 | 2-3 days |
| Entry Skill Assessment | ~2 | ~3 | 1-2 days |
| Learner Profile Store | ~2 | ~2 | 1 day |
| Gemini AI Integration | ~3 | ~2 | 2-3 days |
| Exercise Buffer/Cache | ~2 | ~1 | 1 day |
| Offline Templates | ~2 | ~1 | 1 day |
| Split Keyboard Mode | ~2 | ~3 | 2 days |
| Auto-Scroll Enhancements | ~0 | ~2 | 0.5 days |
| Daily Challenge System | ~2 | ~2 | 1 day |
| Streak System | ~1 | ~3 | 1 day |
| Achievement Expansion | ~1 | ~2 | 1 day |
| Cat Mood + Quests | ~1 | ~3 | 1 day |
| UI: Design Tokens + Theme | ~2 | ~3 | 1 day |
| UI: HomeScreen Redesign | ~1 | ~1 | 2 days |
| UI: Level Map Redesign | ~0 | ~1 | 1.5 days |
| UI: Exercise Player Polish | ~1 | ~2 | 1 day |
| UI: Profile + Achievements | ~0 | ~2 | 1 day |
| UI: Onboarding Polish | ~0 | ~1 | 0.5 days |
| UI: Micro-Interactions | ~1 | ~5 | 1 day |
| **Total** | **~25** | **~44** | **21-27 days** |

---

## 6. Dependencies & API Costs

**Gemini Flash API:**
- ~$0.075 per 1M input tokens
- Average exercise generation: ~500 input tokens, ~300 output tokens
- 10K users × 10 exercises/day = 100K calls/day
- Cost: ~$0.50/day at scale

**Firebase (existing):**
- Firestore reads for learner profile: minimal (cached locally)
- Firestore writes: 1 per exercise completion (batch with existing score write)

**No new dependencies required** — Gemini accessed via `fetch()` to REST API.
