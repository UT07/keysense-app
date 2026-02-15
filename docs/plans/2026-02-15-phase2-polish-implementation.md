# Phase 2 Polish: Keysie Avatar & UI Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace emoji mascot with animated SVG cat character, add visual polish (gradients, shadows, score ring), refine interactions, and verify onboarding E2E.

**Architecture:** New `KeysieAvatar` SVG component with 5 mood states animated via Reanimated. Replaces emoji in MascotBubble. Integrated into 6 screens. Visual polish via LinearGradient, consistent card shadows, and animated score ring (SVG circle).

**Tech Stack:** react-native-svg (installed), react-native-reanimated (installed), expo-linear-gradient (installed), Jest + RNTL

---

### Task 1: Create KeysieSvg — Static SVG Cat Character

**Files:**
- Create: `src/components/Mascot/KeysieSvg.tsx`
- Create: `src/components/Mascot/types.ts`
- Test: `src/components/Mascot/__tests__/KeysieSvg.test.tsx`

**Step 1: Create shared types**

Create `src/components/Mascot/types.ts`:
```typescript
export type MascotMood = 'happy' | 'encouraging' | 'excited' | 'teaching' | 'celebrating';
export type MascotSize = 'tiny' | 'small' | 'medium' | 'large';

export const MASCOT_SIZES: Record<MascotSize, number> = {
  tiny: 24,
  small: 40,
  medium: 56,
  large: 80,
};
```

**Step 2: Write the failing test**

Create `src/components/Mascot/__tests__/KeysieSvg.test.tsx`:
```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { KeysieSvg } from '../KeysieSvg';

describe('KeysieSvg', () => {
  it('renders without crashing at each size', () => {
    const sizes = ['tiny', 'small', 'medium', 'large'] as const;
    for (const size of sizes) {
      const { getByTestId } = render(<KeysieSvg size={size} mood="happy" />);
      expect(getByTestId('keysie-svg')).toBeTruthy();
    }
  });

  it('renders all 5 moods', () => {
    const moods = ['happy', 'encouraging', 'excited', 'teaching', 'celebrating'] as const;
    for (const mood of moods) {
      const { getByTestId } = render(<KeysieSvg size="medium" mood={mood} />);
      expect(getByTestId('keysie-svg')).toBeTruthy();
    }
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd /Users/ut/Documents/KeySense/keysense-app && npx jest src/components/Mascot/__tests__/KeysieSvg.test.tsx --verbose`
Expected: FAIL — KeysieSvg not found

**Step 4: Implement KeysieSvg**

Create `src/components/Mascot/KeysieSvg.tsx` — A music-themed cat with:
- **Body:** Rounded dark grey (#2A2A2A) cat silhouette
- **Head:** Round with pointed ears, ear interiors are crimson (#DC143C)
- **Eyes:** Mood-dependent (happy=curved crescents, teaching=wide circles, celebrating=star shapes, encouraging=soft ovals, excited=big sparkle)
- **Mouth:** Small curve (mood-dependent — smile, grin, open, neutral)
- **Headphones:** Crimson band across top of head, circular ear cups
- **Collar:** Piano-key pattern (alternating white/black rectangles)
- **Tail:** Curves up ending in eighth-note shape
- **Whiskers:** 3 lines each side

```typescript
import React from 'react';
import Svg, { G, Circle, Path, Rect, Ellipse, Line } from 'react-native-svg';
import type { MascotMood, MascotSize } from './types';
import { MASCOT_SIZES } from './types';

interface KeysieSvgProps {
  mood: MascotMood;
  size: MascotSize;
}

// Eye shapes per mood
const EYE_VARIANTS: Record<MascotMood, 'crescents' | 'wide' | 'sparkle' | 'soft' | 'big'> = {
  happy: 'crescents',
  teaching: 'wide',
  celebrating: 'sparkle',
  encouraging: 'soft',
  excited: 'big',
};

// Mouth path per mood (relative to 100x100 viewBox, mouth center ~50,68)
const MOUTH_PATHS: Record<MascotMood, string> = {
  happy: 'M 43 66 Q 50 72 57 66',           // gentle smile
  encouraging: 'M 44 66 Q 50 71 56 66',     // soft smile
  excited: 'M 42 65 Q 50 75 58 65 Z',       // open grin
  teaching: 'M 45 67 L 55 67',              // neutral line
  celebrating: 'M 40 64 Q 50 76 60 64 Z',   // big open smile
};

export const KeysieSvg: React.FC<KeysieSvgProps> = ({ mood, size }) => {
  const px = MASCOT_SIZES[size];
  const eyeType = EYE_VARIANTS[mood];

  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 100 100"
      testID="keysie-svg"
    >
      {/* Body */}
      <Ellipse cx={50} cy={82} rx={22} ry={16} fill="#2A2A2A" />

      {/* Tail — eighth note curl */}
      <Path
        d="M 72 80 Q 85 70 80 55 Q 78 48 82 45"
        stroke="#2A2A2A"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={82} cy={43} r={4} fill="#DC143C" />

      {/* Head */}
      <Circle cx={50} cy={48} r={26} fill="#3A3A3A" />

      {/* Ears */}
      <Path d="M 28 35 L 22 12 L 40 28 Z" fill="#3A3A3A" />
      <Path d="M 72 35 L 78 12 L 60 28 Z" fill="#3A3A3A" />
      {/* Ear interiors */}
      <Path d="M 30 32 L 26 16 L 38 28 Z" fill="#DC143C" opacity={0.7} />
      <Path d="M 70 32 L 74 16 L 62 28 Z" fill="#DC143C" opacity={0.7} />

      {/* Headphone band */}
      <Path
        d="M 26 38 Q 50 18 74 38"
        stroke="#DC143C"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      {/* Headphone cups */}
      <Rect x={20} y={34} width={10} height={14} rx={4} fill="#DC143C" />
      <Rect x={70} y={34} width={10} height={14} rx={4} fill="#DC143C" />

      {/* Eyes */}
      {eyeType === 'crescents' && (
        <>
          <Path d="M 38 46 Q 41 42 44 46" stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" />
          <Path d="M 56 46 Q 59 42 62 46" stroke="#FFFFFF" strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
      {eyeType === 'wide' && (
        <>
          <Circle cx={41} cy={44} r={4} fill="#FFFFFF" />
          <Circle cx={59} cy={44} r={4} fill="#FFFFFF" />
          <Circle cx={42} cy={44} r={2} fill="#1A1A1A" />
          <Circle cx={60} cy={44} r={2} fill="#1A1A1A" />
        </>
      )}
      {eyeType === 'sparkle' && (
        <>
          <Path d="M 41 44 L 39 40 L 41 42 L 43 40 L 41 44 L 39 46 L 41 44 L 43 46 Z" fill="#FFD700" />
          <Path d="M 59 44 L 57 40 L 59 42 L 61 40 L 59 44 L 57 46 L 59 44 L 61 46 Z" fill="#FFD700" />
        </>
      )}
      {eyeType === 'soft' && (
        <>
          <Ellipse cx={41} cy={44} rx={3.5} ry={3} fill="#FFFFFF" />
          <Ellipse cx={59} cy={44} rx={3.5} ry={3} fill="#FFFFFF" />
          <Circle cx={41} cy={44} r={1.8} fill="#1A1A1A" />
          <Circle cx={59} cy={44} r={1.8} fill="#1A1A1A" />
        </>
      )}
      {eyeType === 'big' && (
        <>
          <Circle cx={41} cy={44} r={5} fill="#FFFFFF" />
          <Circle cx={59} cy={44} r={5} fill="#FFFFFF" />
          <Circle cx={42} cy={43} r={2.5} fill="#1A1A1A" />
          <Circle cx={60} cy={43} r={2.5} fill="#1A1A1A" />
          <Circle cx={43} cy={42} r={1} fill="#FFFFFF" />
          <Circle cx={61} cy={42} r={1} fill="#FFFFFF" />
        </>
      )}

      {/* Nose */}
      <Ellipse cx={50} cy={55} rx={2.5} ry={2} fill="#DC143C" />

      {/* Mouth */}
      <Path d={MOUTH_PATHS[mood]} stroke="#FFFFFF" strokeWidth={1.5} fill={mood === 'excited' || mood === 'celebrating' ? '#8B0000' : 'none'} strokeLinecap="round" />

      {/* Whiskers */}
      <Line x1={30} y1={53} x2={18} y2={50} stroke="#666" strokeWidth={1} />
      <Line x1={30} y1={56} x2={16} y2={56} stroke="#666" strokeWidth={1} />
      <Line x1={30} y1={59} x2={18} y2={62} stroke="#666" strokeWidth={1} />
      <Line x1={70} y1={53} x2={82} y2={50} stroke="#666" strokeWidth={1} />
      <Line x1={70} y1={56} x2={84} y2={56} stroke="#666" strokeWidth={1} />
      <Line x1={70} y1={59} x2={82} y2={62} stroke="#666" strokeWidth={1} />

      {/* Piano-key collar */}
      <G>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Rect
            key={i}
            x={36 + i * 4}
            y={72}
            width={4}
            height={5}
            fill={i % 2 === 0 ? '#FFFFFF' : '#1A1A1A'}
            rx={0.5}
          />
        ))}
      </G>
    </Svg>
  );
};
```

**Step 5: Run test to verify it passes**

Run: `npx jest src/components/Mascot/__tests__/KeysieSvg.test.tsx --verbose`
Expected: PASS (2 tests)

**Step 6: Commit**

```bash
git add src/components/Mascot/KeysieSvg.tsx src/components/Mascot/types.ts src/components/Mascot/__tests__/KeysieSvg.test.tsx
git commit -m "feat: add Keysie SVG cat character with 5 mood variants"
```

---

### Task 2: Create KeysieAvatar — Animated Wrapper

**Files:**
- Create: `src/components/Mascot/KeysieAvatar.tsx`
- Test: `src/components/Mascot/__tests__/KeysieAvatar.test.tsx`

**Step 1: Write the failing test**

Create `src/components/Mascot/__tests__/KeysieAvatar.test.tsx`:
```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { KeysieAvatar } from '../KeysieAvatar';

describe('KeysieAvatar', () => {
  it('renders with default props', () => {
    const { getByTestId } = render(<KeysieAvatar mood="happy" />);
    expect(getByTestId('keysie-avatar')).toBeTruthy();
  });

  it('renders at all 4 sizes', () => {
    const sizes = ['tiny', 'small', 'medium', 'large'] as const;
    for (const size of sizes) {
      const { getByTestId } = render(<KeysieAvatar mood="happy" size={size} />);
      expect(getByTestId('keysie-avatar')).toBeTruthy();
    }
  });

  it('shows particles when celebrating with showParticles', () => {
    const { queryByTestId } = render(
      <KeysieAvatar mood="celebrating" showParticles />
    );
    expect(queryByTestId('keysie-particles')).toBeTruthy();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/components/Mascot/__tests__/KeysieAvatar.test.tsx --verbose`
Expected: FAIL

**Step 3: Implement KeysieAvatar**

Create `src/components/Mascot/KeysieAvatar.tsx`:
- Wraps `KeysieSvg` in an `Animated.View`
- `idle` mood: breathing scale pulse (1.0 → 1.02 → 1.0, 2.5s loop) + ear twitch every 4s (rotate ±3deg)
- `celebrating` mood: bounce (translateY 0 → -8 → 0, 600ms loop) + optional star particles
- `encouraging` mood: subtle nod (rotate 0 → 5 → -5 → 0, 1.2s, once)
- `teaching` mood: head tilt (rotate 0 → -8, 800ms, hold)
- `sad` mood: droop then perk (translateY 0 → 4 → 0, 1s, once)
- Particles: 5 small star/note emojis that float upward and fade for `celebrating`

**Step 4: Run test to verify it passes**

Run: `npx jest src/components/Mascot/__tests__/KeysieAvatar.test.tsx --verbose`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/components/Mascot/KeysieAvatar.tsx src/components/Mascot/__tests__/KeysieAvatar.test.tsx
git commit -m "feat: add animated KeysieAvatar wrapper with mood animations"
```

---

### Task 3: Refactor MascotBubble to Use KeysieAvatar

**Files:**
- Modify: `src/components/Mascot/MascotBubble.tsx`
- Modify: `src/components/Mascot/mascotTips.ts` (re-export MascotMood from types.ts)

**Step 1: Update mascotTips.ts to use shared type**

In `src/components/Mascot/mascotTips.ts`:
- Remove local `MascotMood` type definition
- Add `import type { MascotMood } from './types';`
- Re-export: `export type { MascotMood } from './types';`

**Step 2: Replace emoji avatar with KeysieAvatar in MascotBubble.tsx**

In `src/components/Mascot/MascotBubble.tsx`:
- Remove `MOOD_EXPRESSIONS` (emoji map)
- Remove `EMOJI_SIZES` map
- Import `KeysieAvatar` and the size mapping
- Replace the emoji `<Text>` inside the avatar `<View>` with `<KeysieAvatar mood={mood} size={sizeToMascotSize} />`
- Size mapping: MascotBubble small → KeysieAvatar 'small', medium → 'medium', large → 'large'
- Keep mood-tinted background and border colors (they complement the SVG)

**Step 3: Run existing MascotBubble tests + new tests**

Run: `npx jest src/components/Mascot/ --verbose`
Expected: All tests pass

**Step 4: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 errors

**Step 5: Commit**

```bash
git add src/components/Mascot/
git commit -m "refactor: replace emoji mascot with KeysieAvatar SVG cat"
```

---

### Task 4: Integrate Keysie into ExerciseCard

**Files:**
- Modify: `src/components/transitions/ExerciseCard.tsx`

**Step 1: Add KeysieAvatar to the tip section**

In `src/components/transitions/ExerciseCard.tsx`:
- Import `KeysieAvatar` from `../Mascot/KeysieAvatar`
- Import `MascotMood` type
- Add mood calculation based on score: `>=90 celebrating, >=70 encouraging, <70 teaching`
- Replace the plain `tipContainer` with a row: `[KeysieAvatar small] [tip text]`
- Add `flexDirection: 'row'` to tipContainer with `alignItems: 'center'` and `gap: 10`

**Step 2: Run tests**

Run: `npx jest --silent`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/transitions/ExerciseCard.tsx
git commit -m "feat: add Keysie avatar to ExerciseCard tip section"
```

---

### Task 5: Integrate Keysie into CompletionModal

**Files:**
- Modify: `src/screens/ExercisePlayer/CompletionModal.tsx`

**Step 1: Replace MascotBubble emoji with KeysieAvatar**

In `src/screens/ExercisePlayer/CompletionModal.tsx`:
- Import `KeysieAvatar` alongside existing `MascotBubble`
- In the mascotSection: render `KeysieAvatar` (medium, with `showParticles` for celebrating mood) next to the speech bubble text
- Remove the old `MascotBubble` usage, replace with:
  ```
  <View style={styles.mascotSection}>
    <KeysieAvatar mood={mascotData.mood} size="medium" showParticles={mascotData.mood === 'celebrating'} />
    <View style={styles.mascotBubble}>
      <Text style={styles.mascotMessage}>{mascotData.message}</Text>
    </View>
  </View>
  ```
- Keep the AI Coach section below unchanged

**Step 2: Run tests**

Run: `npx jest --silent`
Expected: All pass

**Step 3: Commit**

```bash
git add src/screens/ExercisePlayer/CompletionModal.tsx
git commit -m "feat: use KeysieAvatar in CompletionModal replacing emoji mascot"
```

---

### Task 6: Add Keysie to Level Map (Current Node)

**Files:**
- Modify: `src/screens/LevelMapScreen.tsx`

**Step 1: Add Keysie to the current lesson node**

In `src/screens/LevelMapScreen.tsx`:
- Import `KeysieAvatar` and `getRandomTip`
- For the node with `state === 'current'`:
  - Render `KeysieAvatar` (size 'small') positioned above the node circle (absolute positioning, `top: -35`)
  - Add a small speech bubble below Keysie with a rotating tip (use `getRandomTip()`)
  - The tip changes every 8 seconds using a `useEffect` + `setInterval`
- Keysie only appears on the current node (not completed or locked)

**Step 2: Run tests and TypeScript check**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 errors, all tests pass

**Step 3: Commit**

```bash
git add src/screens/LevelMapScreen.tsx
git commit -m "feat: add Keysie mascot to current lesson node on level map"
```

---

### Task 7: Add Keysie to HomeScreen Greeting

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

**Step 1: Add Keysie next to greeting text**

In `src/screens/HomeScreen.tsx`:
- Import `KeysieAvatar`
- In the header section, add `KeysieAvatar` (size 'small', mood 'happy') next to the greeting text
- Layout: `flexDirection: 'row'` with greeting text on left, Keysie avatar on right
- Keysie does idle breathing animation

**Step 2: Run tests**

Run: `npx jest --silent`
Expected: All pass

**Step 3: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat: add Keysie avatar to HomeScreen greeting header"
```

---

### Task 8: Add Keysie to LessonCompleteScreen

**Files:**
- Modify: `src/components/transitions/LessonCompleteScreen.tsx`

**Step 1: Add Keysie celebrating alongside trophy**

In `src/components/transitions/LessonCompleteScreen.tsx`:
- Import `KeysieAvatar`
- In the trophy section, add `KeysieAvatar` (size 'large', mood 'celebrating', showParticles) below or beside the trophy emoji
- Layout: trophy above, Keysie below with a congratulatory speech bubble

**Step 2: Run tests and commit**

Run: `npx jest --silent`

```bash
git add src/components/transitions/LessonCompleteScreen.tsx
git commit -m "feat: add celebrating Keysie to LessonCompleteScreen"
```

---

### Task 9: Gradient Headers

**Files:**
- Modify: `src/screens/HomeScreen.tsx`
- Modify: `src/screens/ProfileScreen.tsx`

**Step 1: Upgrade HomeScreen header gradient**

In `src/screens/HomeScreen.tsx`:
- The header already uses `LinearGradient` (imported). Verify the gradient goes from `#1A1A1A` → `#141414` → `#0D0D0D`
- If it's a flat color, wrap the header `View` in `<LinearGradient colors={['#1E1E1E', '#151515', '#0D0D0D']} style={styles.header}>`

**Step 2: Upgrade ProfileScreen header**

In `src/screens/ProfileScreen.tsx`:
- Import `LinearGradient` from `expo-linear-gradient`
- Replace header `<View style={styles.profileHeader}>` with `<LinearGradient colors={['#1E1E1E', '#151515', '#0D0D0D']} style={styles.profileHeader}>`

**Step 3: Standardize card shadows**

Add consistent shadow to all card styles across both screens:
```typescript
cardShadow: {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 8,
  elevation: 6,
}
```

**Step 4: Run tests and commit**

```bash
npx jest --silent
git add src/screens/HomeScreen.tsx src/screens/ProfileScreen.tsx
git commit -m "polish: gradient headers and consistent card shadows"
```

---

### Task 10: Animated Score Ring

**Files:**
- Create: `src/components/common/ScoreRing.tsx`
- Create: `src/components/common/__tests__/ScoreRing.test.tsx`
- Modify: `src/components/transitions/ExerciseCard.tsx`
- Modify: `src/screens/ExercisePlayer/CompletionModal.tsx`

**Step 1: Write failing test for ScoreRing**

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { ScoreRing } from '../ScoreRing';

describe('ScoreRing', () => {
  it('renders with a score', () => {
    const { getByText } = render(<ScoreRing score={85} size={80} />);
    expect(getByText('85')).toBeTruthy();
  });

  it('renders percentage sign', () => {
    const { getByText } = render(<ScoreRing score={95} size={80} />);
    expect(getByText('%')).toBeTruthy();
  });
});
```

**Step 2: Implement ScoreRing**

Create `src/components/common/ScoreRing.tsx`:
- SVG circle with `strokeDasharray` and `strokeDashoffset` for ring fill
- Animated via Reanimated `useSharedValue` — ring fills from 0 to `score%` over 800ms
- Color: red (<60) → orange (60-79) → green (80-94) → gold (95+)
- Center text: score number (large) + % (small)
- Props: `score: number, size: number, strokeWidth?: number, animated?: boolean`

**Step 3: Replace static score circles in ExerciseCard and CompletionModal**

- In `ExerciseCard.tsx`: replace the `scoreCircle` View with `<ScoreRing score={score} size={80} />`
- In `CompletionModal.tsx`: replace the score display with `<ScoreRing score={score.overall} size={120} />`

**Step 4: Run all tests**

Run: `npx jest --silent`
Expected: All pass

**Step 5: Commit**

```bash
git add src/components/common/ScoreRing.tsx src/components/common/__tests__/ScoreRing.test.tsx src/components/transitions/ExerciseCard.tsx src/screens/ExercisePlayer/CompletionModal.tsx
git commit -m "feat: animated ScoreRing component, integrated into ExerciseCard and CompletionModal"
```

---

### Task 11: Button Press Feedback

**Files:**
- Create: `src/components/common/PressableScale.tsx`
- Modify: `src/screens/HomeScreen.tsx` (use PressableScale for quick action buttons)
- Modify: `src/screens/LevelMapScreen.tsx` (use PressableScale for lesson nodes)

**Step 1: Create PressableScale**

Create `src/components/common/PressableScale.tsx`:
```typescript
import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps extends PressableProps {
  scaleDown?: number; // default 0.97
}

export const PressableScale: React.FC<PressableScaleProps> = ({
  children,
  scaleDown = 0.97,
  style,
  ...props
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...props}
      style={[animatedStyle, style]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleDown, { damping: 15, stiffness: 200 });
        props.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 12, stiffness: 180 });
        props.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
};
```

**Step 2: Replace key `TouchableOpacity` instances**

In `HomeScreen.tsx` and `LevelMapScreen.tsx`: replace main action button `TouchableOpacity` with `PressableScale` for tactile feedback on lesson nodes and quick action cards.

**Step 3: Run tests and commit**

```bash
npx jest --silent
git add src/components/common/PressableScale.tsx src/screens/HomeScreen.tsx src/screens/LevelMapScreen.tsx
git commit -m "feat: PressableScale component for tactile button feedback"
```

---

### Task 12: Keyboard Visual Polish

**Files:**
- Modify: `src/components/Keyboard/PianoKey.tsx`

**Step 1: Add gradient to white keys**

In `src/components/Keyboard/PianoKey.tsx`:
- Import `LinearGradient` from `expo-linear-gradient`
- White key background: `<LinearGradient colors={['#FFFFFF', '#F5F5F5', '#EBEBEB']}>`
- Black key background: `<LinearGradient colors={['#2A2A2A', '#1A1A1A', '#111111']}>`
- Expected note highlight: pulsing glow (animated borderColor + shadow) instead of static green

**Step 2: Improve pressed state**

- Pressed white key: darker gradient `['#E8E8E8', '#DEDEDE', '#D0D0D0']` + increased shadow
- Pressed black key: lighter `['#333333', '#2A2A2A', '#1E1E1E']`

**Step 3: Run tests and commit**

```bash
npx jest --silent && npx tsc --noEmit
git add src/components/Keyboard/PianoKey.tsx
git commit -m "polish: keyboard key gradients and improved pressed states"
```

---

### Task 13: Onboarding E2E Verification + Keysie Integration

**Files:**
- Modify: `src/screens/OnboardingScreen.tsx`
- Create: `src/screens/__tests__/OnboardingScreen.test.tsx`

**Step 1: Add Keysie to each onboarding step**

In `src/screens/OnboardingScreen.tsx`:
- Import `KeysieAvatar`
- Step 1 (Welcome): Replace `🎹` emoji with `<KeysieAvatar mood="celebrating" size="large" />`
- Step 2 (Experience): Add `<KeysieAvatar mood="teaching" size="medium" />` above the title
- Step 3 (Equipment): Add `<KeysieAvatar mood="teaching" size="medium" />` (curious head tilt)
- Step 4 (Goal): Add `<KeysieAvatar mood="encouraging" size="medium" />` above title

**Step 2: Write onboarding flow test**

Create `src/screens/__tests__/OnboardingScreen.test.tsx`:
```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
// Test that all 4 steps render and can be navigated

describe('OnboardingScreen', () => {
  it('shows welcome step initially', () => {
    // Render with mock navigation
    // Assert "Welcome to KeySense" text visible
  });

  it('progresses through all 4 steps', () => {
    // Tap "Get Started" → step 2
    // Select beginner → step 3
    // Select screen keyboard → step 4
    // Select goal → completes
  });

  it('persists hasCompletedOnboarding on finish', () => {
    // After all steps, verify settingsStore.hasCompletedOnboarding === true
  });
});
```

**Step 3: Run tests and commit**

```bash
npx jest --silent && npx tsc --noEmit
git add src/screens/OnboardingScreen.tsx src/screens/__tests__/OnboardingScreen.test.tsx
git commit -m "feat: add Keysie to onboarding + E2E verification tests"
```

---

### Task 14: Final Verification & Phase 2 Close

**Files:**
- No new files — verification only

**Step 1: Run full test suite**

Run: `npx tsc --noEmit && npx jest --silent`
Expected: 0 TS errors, all tests pass

**Step 2: Visual verification on simulator**

Run: `npx expo start --port 8081`
- Boot simulator, open dev build
- Walk through: Onboarding → Home → Level Map → Free Play → Exercise → Completion
- Verify Keysie appears at each integration point
- Verify gradients, score ring animation, button press feedback

**Step 3: Take screenshots for documentation**

```bash
xcrun simctl io booted screenshot /tmp/keysense-home.png
xcrun simctl io booted screenshot /tmp/keysense-levelmap.png
```

**Step 4: Final commit**

```bash
npx tsc --noEmit && npx jest --silent
git add -A
git commit -m "Phase 2 complete: Keysie avatar, visual polish, onboarding verified"
```
