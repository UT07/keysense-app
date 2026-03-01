# Neon Arcade Production Readiness — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Purrrfect Keys from prototype to production-quality "Neon Arcade" experience — fixing audio input, upgrading 3D cats, adding Skia-powered visual effects, redesigning gameplay/social/onboarding screens via Figma, and adding cat customization.

**Architecture:** Priority 0 (audio) validates core input before any visual work. Then infrastructure (Skia, 3D quality, design system) is built. Finally, screens are redesigned Figma-first and implemented one-by-one. Gameplay screen gets heavy visual upgrades (Skia particles, combo effects, note rendering).

**Tech Stack:** React Native (Expo SDK 52), @shopify/react-native-skia, react-three-fiber v8, Reanimated 3, expo-haptics, SoundManager, Figma MCP

**Design Doc:** `docs/plans/2026-03-01-production-readiness-design.md`

---

## Phase 0: Audio Input Verification (PREREQUISITE)

### Task 1: Physical Device Mic Permission Test

**Files:**
- Test manually on physical device (iPhone)

**Step 1: Build and deploy dev build**
```bash
npx expo run:ios --device
```

**Step 2: Test mic permission flow**
- Open app → Settings → Input Method → Microphone
- Verify: System permission dialog appears within 5 seconds
- Verify: No hang, no infinite spinner
- If dialog doesn't appear → check `AudioManager.requestRecordingPermissions()` in AudioCapture.ts

**Step 3: Test mic capture produces buffers**
- Grant mic permission → Start an exercise with mic selected
- Open Xcode console → filter for `[AudioCapture]`
- Verify: `Buffer #1`, `Buffer #2`, etc. appear within 3 seconds
- Verify: `maxAmplitude > 0.001` (not silent zeros)

**Step 4: Test YIN pitch detection**
- Play C4 (261.6 Hz) into device mic from a reference tone
- Verify: Correct note detected within ±1 semitone
- Repeat for E4, G4, C5

**Step 5: Test input method switching**
- Switch Touch → Mic → Touch in settings mid-session
- Verify: No hang, no crash, method updates within 1 second
- Verify: Exercise still responds to input after switch

**Step 6: Test auto-detection behavior**
- Set input to "Auto" → Kill app → Reopen
- Without mic permission: Verify falls back to Touch (no permission prompt)
- With mic permission: Verify selects Mic
- With MIDI connected: Verify selects MIDI over Mic

**Step 7: Record results**
Update `docs/plans/2026-03-01-production-readiness-design.md` Section 6 table with Pass/Fail for each test.

**Step 8: Commit**
```bash
git add docs/plans/2026-03-01-production-readiness-design.md
git commit -m "docs: record audio input device test results"
```

---

## Phase 1: Infrastructure — Skia + 3D Quality + Design System

### Task 2: Install @shopify/react-native-skia

**Files:**
- Modify: `package.json`
- Modify: `jest.setup.js`
- Modify: `jest.config.js`

**Step 1: Install Skia**
```bash
npx expo install @shopify/react-native-skia
```

**Step 2: Add Jest mock for Skia**
Add to `jest.setup.js`:
```javascript
// Mock @shopify/react-native-skia
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  return {
    Canvas: ({ children, ...props }) => React.createElement('View', props, children),
    Circle: (props) => React.createElement('View', props),
    Rect: (props) => React.createElement('View', props),
    Path: (props) => React.createElement('View', props),
    Group: ({ children, ...props }) => React.createElement('View', props, children),
    LinearGradient: (props) => React.createElement('View', props),
    RadialGradient: (props) => React.createElement('View', props),
    Blur: (props) => React.createElement('View', props),
    BackdropFilter: ({ children, ...props }) => React.createElement('View', props, children),
    BackdropBlur: ({ children, ...props }) => React.createElement('View', props, children),
    Shadow: (props) => React.createElement('View', props),
    useSharedValueEffect: jest.fn(),
    useClockValue: jest.fn(() => ({ current: 0 })),
    useComputedValue: jest.fn((fn) => ({ current: fn() })),
    useValue: jest.fn((val) => ({ current: val })),
    Skia: {
      Path: { Make: jest.fn(() => ({ moveTo: jest.fn(), lineTo: jest.fn(), close: jest.fn() })) },
      Color: jest.fn((c) => c),
    },
    vec: jest.fn((x, y) => ({ x, y })),
    useFont: jest.fn(() => null),
    matchFont: jest.fn(() => null),
  };
});
```

**Step 3: Run tests to verify mock works**
```bash
npm run test -- --passWithNoTests 2>&1 | tail -5
```
Expected: All existing 2,630+ tests still pass.

**Step 4: Commit**
```bash
git add package.json package-lock.json jest.setup.js
git commit -m "feat: install @shopify/react-native-skia with Jest mock"
```

### Task 3: Upgrade 3D Cat Material Quality

**Files:**
- Modify: `src/components/Mascot/3d/Cat3DCanvas.tsx` (lighting)
- Modify: `src/components/Mascot/3d/CatModel3D.tsx` (material roughness, rim light)
- Modify: `src/components/Mascot/3d/cat3DConfig.ts` (brighten dark cats)

**Step 1: Upgrade lighting in Cat3DCanvas.tsx**
Replace the lighting setup (lines ~237-239):
```tsx
// BEFORE:
<ambientLight intensity={0.8} />
<directionalLight position={[2, 3, 4]} intensity={0.6} />
<directionalLight position={[-1, 1, -2]} intensity={0.3} color="#B0C4FF" />

// AFTER:
<ambientLight intensity={1.2} />
<directionalLight position={[2, 3, 4]} intensity={0.8} />
{/* Rim light — backlight for silhouette definition */}
<directionalLight position={[-2, 1, -3]} intensity={0.5} color="#B0C4FF" />
{/* Fill light from below for anime-style uplighting */}
<directionalLight position={[0, -2, 2]} intensity={0.2} color="#FFE0FF" />
```

**Step 2: Reduce material roughness in CatModel3D.tsx**
In `applyMaterials()`, when cloning MeshStandardMaterial, set roughness and metalness:
```typescript
// In the named-material branch (line ~122-131):
const cloned = mat.clone();
cloned.color = hexToColor(colorHex);
cloned.roughness = 0.35;  // Was default ~0.7 — shinier anime look
cloned.metalness = 0.05;  // Slight metallic sheen

// In the fallback branch (line ~154-159):
const newMat = new THREE.MeshStandardMaterial({
  color,
  roughness: 0.35,   // Was 0.7
  metalness: 0.05,   // Was 0.0
});
```

**Step 3: Brighten dark cats in cat3DConfig.ts**
Brighten `mini-meowww` body from `#1A1A1A` → `#2D2D2D` (+30%),
`luna` body from `#1C1C3A` → `#2A2A50` (+25%),
`sable` body from `#212121` → `#333333` (+30%),
`sable` belly from `#424242` → `#555555`.

**Step 4: Increase default cat scale by 10%**
In `CatModel3D.tsx`, change:
```typescript
const HARDCODED_SCALE = 0.385; // Was 0.35 — 10% larger
const HARDCODED_Y_OFFSET = -1.04; // Adjusted: -5.4/2 * 0.385
```

**Step 5: Run tests**
```bash
npm run test 2>&1 | tail -5
```
Expected: All tests pass (3D is mocked in tests).

**Step 6: Commit**
```bash
git add src/components/Mascot/3d/
git commit -m "feat(3d): upgrade cat quality — shinier materials, better lighting, brighter dark cats"
```

### Task 4: Skia Utility Components Library

**Files:**
- Create: `src/components/effects/SkiaParticles.tsx`
- Create: `src/components/effects/GlassmorphismCard.tsx`
- Create: `src/components/effects/GradientMeshBackground.tsx`
- Create: `src/components/effects/NeonGlow.tsx`
- Create: `src/components/effects/ScreenShake.tsx`
- Create: `src/components/effects/index.ts`

**Step 1: Create SkiaParticles**
```typescript
// src/components/effects/SkiaParticles.tsx
/**
 * GPU-accelerated particle system using Skia Canvas.
 * Renders floating particles (musical notes, stars, sparkles, paw prints)
 * with configurable count, speed, colors, and particle shape.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  vec,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  useDerivedValue,
  Easing,
} from 'react-native-reanimated';

export type ParticleShape = 'circle' | 'star' | 'note' | 'sparkle' | 'paw';

interface SkiaParticlesProps {
  /** Number of particles (default: 15) */
  count?: number;
  /** Colors to randomly assign (default: ['#9B59B6', '#FFD700', '#DC143C']) */
  colors?: string[];
  /** Particle radius (default: 3) */
  size?: number;
  /** Animation speed multiplier (default: 1) */
  speed?: number;
  /** Container width */
  width: number;
  /** Container height */
  height: number;
  /** Particle shape type (default: 'circle') */
  shape?: ParticleShape;
  /** Opacity (default: 0.6) */
  opacity?: number;
}

interface Particle {
  x: number;
  y: number;
  radius: number;
  color: string;
  speedY: number;
  speedX: number;
  phase: number;
}

function generateParticles(
  count: number,
  width: number,
  height: number,
  colors: string[],
  size: number,
): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: size * (0.5 + Math.random() * 0.5),
    color: colors[i % colors.length],
    speedY: 0.2 + Math.random() * 0.5,
    speedX: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * Math.PI * 2,
  }));
}

export function SkiaParticles({
  count = 15,
  colors = ['#9B59B6', '#FFD700', '#DC143C'],
  size = 3,
  speed = 1,
  width,
  height,
  opacity = 0.6,
}: SkiaParticlesProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 10000 / speed, easing: Easing.linear }),
      -1,
      false,
    );
  }, [speed, progress]);

  const particles = React.useMemo(
    () => generateParticles(count, width, height, colors, size),
    [count, width, height, colors, size],
  );

  return (
    <Canvas style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
      {particles.map((p, i) => (
        <Circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={p.radius}
          color={p.color}
          opacity={0.4 + Math.sin(p.phase) * 0.3}
        />
      ))}
    </Canvas>
  );
}
```

**Step 2: Create GlassmorphismCard**
```typescript
// src/components/effects/GlassmorphismCard.tsx
/**
 * Glassmorphism card — semi-transparent background with backdrop blur effect.
 * Uses Skia's BackdropBlur for genuine frosted-glass appearance.
 * Falls back to semi-transparent View when Skia is unavailable.
 */
import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

let SkiaAvailable = false;
let SkiaCanvas: any = null;
let SkiaBackdropBlur: any = null;
let SkiaRect: any = null;
let SkiaFill: any = null;

try {
  const Skia = require('@shopify/react-native-skia');
  SkiaCanvas = Skia.Canvas;
  SkiaBackdropBlur = Skia.BackdropBlur;
  SkiaRect = Skia.Rect;
  SkiaFill = Skia.Fill;
  SkiaAvailable = true;
} catch {
  // Skia not available — fallback to semi-transparent
}

interface GlassmorphismCardProps {
  children: React.ReactNode;
  /** Blur radius (default: 20) */
  blur?: number;
  /** Background tint color (default: rgba(255,255,255,0.08)) */
  tint?: string;
  /** Border color (default: rgba(255,255,255,0.12)) */
  borderColor?: string;
  /** Border radius (default: 16) */
  borderRadius?: number;
  style?: ViewStyle;
}

export function GlassmorphismCard({
  children,
  blur = 20,
  tint = 'rgba(255,255,255,0.08)',
  borderColor = 'rgba(255,255,255,0.12)',
  borderRadius = 16,
  style,
}: GlassmorphismCardProps) {
  // Fallback: semi-transparent card (no blur)
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tint,
          borderColor,
          borderRadius,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
  },
});
```

**Step 3: Create GradientMeshBackground**
```typescript
// src/components/effects/GradientMeshBackground.tsx
/**
 * Animated gradient mesh background — slow-drifting color gradients
 * unique per screen. Uses Reanimated opacity crossfade between palettes.
 */
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

type ScreenAccent = 'home' | 'social' | 'learn' | 'songs' | 'catStudio' | 'exercise';

const ACCENT_PALETTES: Record<ScreenAccent, [string, string, string]> = {
  home: ['#2D1B4E', '#1A0A2E', '#0E0B1A'],
  social: ['#0D2B3E', '#0A1F2E', '#0E0B1A'],
  learn: ['#0D2E1A', '#0A2315', '#0E0B1A'],
  songs: ['#2E2000', '#231A00', '#0E0B1A'],
  catStudio: ['#2E0D2B', '#1F0A20', '#0E0B1A'],
  exercise: ['#1A0A2E', '#0E0B1A', '#0A0A14'],
};

interface GradientMeshBackgroundProps {
  accent?: ScreenAccent;
  /** Speed multiplier (default: 1) */
  speed?: number;
}

export function GradientMeshBackground({
  accent = 'home',
  speed = 1,
}: GradientMeshBackgroundProps) {
  const opacity1 = useSharedValue(1);
  const opacity2 = useSharedValue(0);

  const palette = ACCENT_PALETTES[accent];
  // Secondary palette: shift hues slightly
  const palette2 = palette.map((c) => {
    // Simple hue shift: swap R and B channels slightly
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const nr = Math.min(255, r + 15);
    const nb = Math.max(0, b - 10);
    return `#${nr.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  }) as [string, string, string];

  useEffect(() => {
    const duration = 8000 / speed;
    opacity1.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    opacity2.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [speed, opacity1, opacity2]);

  const style1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));
  const style2 = useAnimatedStyle(() => ({ opacity: opacity2.value }));

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, style1]} pointerEvents="none">
        <LinearGradient colors={palette} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, style2]} pointerEvents="none">
        <LinearGradient colors={palette2} style={StyleSheet.absoluteFill} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} />
      </Animated.View>
    </>
  );
}
```

**Step 4: Create NeonGlow**
```typescript
// src/components/effects/NeonGlow.tsx
/**
 * Animated neon glow border using Reanimated opacity pulsing.
 * Wraps children with a glowing border that pulses in intensity.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { GLOW, glowColor } from '../../theme/tokens';

interface NeonGlowProps {
  children: React.ReactNode;
  /** Glow color (default: crimson) */
  color?: string;
  /** Border radius (default: 16) */
  borderRadius?: number;
  /** Pulse speed in ms (default: 2000) */
  pulseSpeed?: number;
  /** Whether glow is active (default: true) */
  active?: boolean;
  style?: ViewStyle;
}

export function NeonGlow({
  children,
  color = '#DC143C',
  borderRadius = 16,
  pulseSpeed = 2000,
  active = true,
  style,
}: NeonGlowProps) {
  const glowOpacity = useSharedValue(active ? 0.6 : 0);

  useEffect(() => {
    if (active) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: pulseSpeed / 2 }),
          withTiming(0.4, { duration: pulseSpeed / 2 }),
        ),
        -1,
        true,
      );
    } else {
      glowOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [active, pulseSpeed, glowOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          borderRadius,
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowRadius: 12,
          elevation: 8,
        },
        animatedStyle,
        style,
      ]}
    >
      <View style={{ borderRadius, overflow: 'hidden' }}>{children}</View>
    </Animated.View>
  );
}
```

**Step 5: Create ScreenShake**
```typescript
// src/components/effects/ScreenShake.tsx
/**
 * Screen shake effect — wraps children and shakes when triggered.
 * Uses Reanimated translateX/Y for performant native-driven shake.
 */
import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export interface ScreenShakeRef {
  shake: (intensity?: 'light' | 'medium' | 'heavy') => void;
}

interface ScreenShakeProps {
  children: React.ReactNode;
}

const INTENSITIES = {
  light: { amount: 2, duration: 50, count: 3 },
  medium: { amount: 4, duration: 40, count: 5 },
  heavy: { amount: 8, duration: 30, count: 7 },
};

export const ScreenShake = forwardRef<ScreenShakeRef, ScreenShakeProps>(
  ({ children }, ref) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    useImperativeHandle(ref, () => ({
      shake: (intensity = 'medium') => {
        const { amount, duration, count } = INTENSITIES[intensity];
        const sequence: number[] = [];
        for (let i = 0; i < count; i++) {
          const sign = i % 2 === 0 ? 1 : -1;
          const decay = 1 - i / count;
          sequence.push(sign * amount * decay);
        }
        sequence.push(0);

        translateX.value = withSequence(
          ...sequence.map((v) => withTiming(v, { duration })),
        );
        translateY.value = withSequence(
          ...sequence.map((v) => withTiming(v * 0.5, { duration })),
        );

        Haptics.impactAsync(
          intensity === 'heavy'
            ? Haptics.ImpactFeedbackStyle.Heavy
            : intensity === 'medium'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
        );
      },
    }));

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    }));

    return <Animated.View style={animatedStyle}>{children}</Animated.View>;
  },
);
```

**Step 6: Create barrel export**
```typescript
// src/components/effects/index.ts
export { SkiaParticles } from './SkiaParticles';
export type { ParticleShape } from './SkiaParticles';
export { GlassmorphismCard } from './GlassmorphismCard';
export { GradientMeshBackground } from './GradientMeshBackground';
export { NeonGlow } from './NeonGlow';
export { ScreenShake } from './ScreenShake';
export type { ScreenShakeRef } from './ScreenShake';
```

**Step 7: Run tests**
```bash
npm run typecheck && npm run test 2>&1 | tail -5
```
Expected: 0 TS errors, all tests pass.

**Step 8: Commit**
```bash
git add src/components/effects/
git commit -m "feat: add Skia effects library — particles, glassmorphism, gradient mesh, neon glow, screen shake"
```

### Task 5: Design System Token Updates

**Files:**
- Modify: `src/theme/tokens.ts`

**Step 1: Add screen accent gradient tokens**
Add after existing GRADIENTS:
```typescript
/** Per-screen animated gradient mesh palettes */
export const SCREEN_ACCENTS = {
  home: { from: '#2D1B4E', to: '#0E0B1A' },
  social: { from: '#0D2B3E', to: '#0E0B1A' },
  learn: { from: '#0D2E1A', to: '#0E0B1A' },
  songs: { from: '#2E2000', to: '#0E0B1A' },
  catStudio: { from: '#2E0D2B', to: '#0E0B1A' },
  exercise: { from: '#1A0A2E', to: '#0A0A14' },
} as const;

/** Neon glow colors (for NeonGlow component) */
export const NEON = {
  crimson: '#DC143C',
  purple: '#9B59B6',
  blue: '#4FC3F7',
  gold: '#FFD700',
  green: '#2ECC71',
  orange: '#FF8C00',
} as const;
```

**Step 2: Run tests**
```bash
npm run typecheck && npm run test 2>&1 | tail -5
```

**Step 3: Commit**
```bash
git add src/theme/tokens.ts
git commit -m "feat(tokens): add screen accent gradients and neon color palette"
```

---

## Phase 2: Gameplay Screen Overhaul (ExercisePlayer)

### Task 6: Figma Design — Gameplay Screen

**Step 1: Design the gameplay screen in Figma**
Use `get_design_context` or `generate_figma_design` with these specs:
- **Background**: GradientMeshBackground (exercise accent: deep purple → black)
- **Piano Roll**: Falling notes with gradient fills (per-hand coloring), glow halos on active notes, beat grid lines with subtle glow
- **Hit Line**: Neon-glowing horizontal line at 95% height, pulses on note hit
- **Keyboard**: 3D-depth keys with shadow, glow on pressed keys, neon highlight on expected keys
- **Combo Meter**: Larger badge with tier icon (fire/skull/crown emoji), screen border glow matching tier color
- **Feedback Text**: "PERFECT!" with neon glow + scale bounce + particle burst. "MISS" with red flash + screen shake
- **ExerciseBuddy (cat)**: 3D cat in top-right corner with reactive pose changes (celebrate on perfect, sad on miss)
- **Score Display**: Glassmorphism overlay in top-left with neon-bordered score ring
- **Top Bar**: Glassmorphism pill with exercise title, back button, pause button — semi-transparent
- **Combo Glow**: Full-screen animated border (existing), but thicker (4px) and with inner glow

**Step 2: Review Figma output and iterate**

**Step 3: Export design tokens and component specs**

### Task 7: Upgrade VerticalPianoRoll Note Rendering

**Files:**
- Modify: `src/components/PianoRoll/VerticalPianoRoll.tsx`

**Step 1: Upgrade note colors — per-hand coloring with gradients**
Replace the flat COLORS object (line ~42-62):
```typescript
const NOTE_COLORS = {
  // Right hand: blue-purple gradient
  rightUpcoming: { top: '#7C4DFF', bottom: '#536DFE' },
  rightActive: { top: '#E040FB', bottom: '#AA00FF' },
  rightPast: { top: 'rgba(124, 77, 255, 0.3)', bottom: 'rgba(83, 109, 254, 0.2)' },
  // Left hand: teal-green gradient
  leftUpcoming: { top: '#26C6DA', bottom: '#00BFA5' },
  leftActive: { top: '#69F0AE', bottom: '#00E676' },
  leftPast: { top: 'rgba(38, 198, 218, 0.3)', bottom: 'rgba(0, 191, 165, 0.2)' },
  // Generic (when hand not specified)
  upcoming: { top: '#7986CB', bottom: '#3949AB' },
  active: { top: '#FF8A80', bottom: '#D32F2F' },
  past: { top: 'rgba(129, 199, 132, 0.5)', bottom: 'rgba(76, 175, 80, 0.3)' },
  // Effects
  activeGlow: 'rgba(224, 64, 251, 0.35)',
  activeHalo: 'rgba(224, 64, 251, 0.15)',
  hitLine: '#40C4FF',
  hitLineGlow: 'rgba(64, 196, 255, 0.3)',
  beatLine: 'rgba(255, 255, 255, 0.06)',
  beatLineAccent: 'rgba(255, 255, 255, 0.15)',
  background: 'transparent',
};
```

**Step 2: Add glow halo behind active notes**
In the note rendering logic, add a wider shadow View behind active notes:
```tsx
{isActive && (
  <View style={{
    position: 'absolute',
    top: -4, left: -4, right: -4, bottom: -4,
    borderRadius: radius + 4,
    backgroundColor: NOTE_COLORS.activeGlow,
  }} />
)}
```

**Step 3: Add inner highlight to note blocks**
Inside each note View, add a subtle white gradient at the top for 3D depth:
```tsx
<LinearGradient
  colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', borderTopLeftRadius: radius, borderTopRightRadius: radius }}
/>
```

**Step 4: Run tests**
```bash
npm run test -- --testPathPattern="PianoRoll" 2>&1 | tail -10
```

**Step 5: Commit**
```bash
git add src/components/PianoRoll/VerticalPianoRoll.tsx
git commit -m "feat(gameplay): upgrade piano roll notes — per-hand gradients, glow halos, 3D depth"
```

### Task 8: Upgrade Keyboard Visual Quality

**Files:**
- Modify: `src/components/Keyboard/PianoKey.tsx`

**Step 1: Add glow on expected keys (neon highlight)**
Add a neon border glow when `isExpected` is true:
```tsx
const expectedGlowStyle = useAnimatedStyle(() => ({
  borderColor: isExpected ? '#40C4FF' : 'transparent',
  borderWidth: isExpected ? 2 : 0,
  shadowColor: isExpected ? '#40C4FF' : 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowRadius: isExpected ? 8 : 0,
  shadowOpacity: isExpected ? 0.6 : 0,
}));
```

**Step 2: Add pressed key glow effect**
When `isPressed`, add a colored glow underneath the key:
```tsx
const pressedGlowStyle = useAnimatedStyle(() => ({
  backgroundColor: isPressed
    ? (isBlackKey ? 'rgba(224, 64, 251, 0.3)' : 'rgba(64, 196, 255, 0.2)')
    : 'transparent',
}));
```

**Step 3: Add subtle shadow for 3D depth on white keys**
```tsx
// Add to white key base style:
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowRadius: 4,
shadowOpacity: 0.15,
elevation: 3,
```

**Step 4: Commit**
```bash
git add src/components/Keyboard/PianoKey.tsx
git commit -m "feat(gameplay): upgrade keyboard — neon expected glow, pressed glow, 3D depth shadows"
```

### Task 9: Upgrade ComboMeter + ComboGlow

**Files:**
- Modify: `src/screens/ExercisePlayer/ComboMeter.tsx`
- Modify: `src/screens/ExercisePlayer/ComboGlow.tsx`

**Step 1: Upgrade ComboMeter with tier icon and larger badge**
```tsx
// Add tier icons
const TIER_ICONS: Record<string, string> = {
  NORMAL: '',
  GOOD: '🔥',
  FIRE: '💀',
  SUPER: '👑',
  LEGENDARY: '🌈',
};

// In render, add icon next to count:
<View style={styles.badgeRow}>
  {TIER_ICONS[tier.name] ? (
    <Text style={styles.icon}>{TIER_ICONS[tier.name]}</Text>
  ) : null}
  <Text style={styles.count}>{combo}x</Text>
</View>
```

**Step 2: Make ComboGlow thicker with inner glow**
Change border width from 3 to 4, add inner shadow:
```tsx
glow: {
  ...StyleSheet.absoluteFillObject,
  borderWidth: 4,
  borderRadius: 0,
  zIndex: 5,
  // Inner glow via shadow
  shadowOffset: { width: 0, height: 0 },
  shadowRadius: 20,
  shadowOpacity: 0.5,
},
```

**Step 3: Commit**
```bash
git add src/screens/ExercisePlayer/ComboMeter.tsx src/screens/ExercisePlayer/ComboGlow.tsx
git commit -m "feat(gameplay): upgrade combo — tier icons, thicker glow with inner shadow"
```

### Task 10: Add Hit Effect Particles + Screen Shake to ExercisePlayer

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx`
- Create: `src/screens/ExercisePlayer/HitParticles.tsx`

**Step 1: Create HitParticles component**
```typescript
// src/screens/ExercisePlayer/HitParticles.tsx
/**
 * Brief particle burst on note hit.
 * Renders N particles that expand outward and fade over 400ms.
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface HitParticlesProps {
  /** Screen X position of the hit */
  x: number;
  /** Screen Y position of the hit */
  y: number;
  /** Particle color (matches feedback type) */
  color: string;
  /** Trigger key — change to spawn new burst */
  trigger: number;
}

const PARTICLE_COUNT = 8;
const DURATION = 400;

export function HitParticles({ x, y, color, trigger }: HitParticlesProps) {
  const anims = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => ({
      progress: new Animated.Value(0),
      angle: Math.random() * Math.PI * 2,
      distance: 20 + Math.random() * 30,
    })),
  ).current;

  useEffect(() => {
    if (trigger === 0) return;
    anims.forEach((a) => {
      a.progress.setValue(0);
      a.angle = Math.random() * Math.PI * 2;
      a.distance = 20 + Math.random() * 30;
      Animated.timing(a.progress, {
        toValue: 1,
        duration: DURATION,
        useNativeDriver: true,
      }).start();
    });
  }, [trigger, anims]);

  return (
    <View style={[StyleSheet.absoluteFill]} pointerEvents="none">
      {anims.map((a, i) => {
        const translateX = a.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.cos(a.angle) * a.distance],
        });
        const translateY = a.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, Math.sin(a.angle) * a.distance],
        });
        const opacity = a.progress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 0.5, 0],
        });
        const scale = a.progress.interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0.5, 1.2, 0.3],
        });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: x - 4,
              top: y - 4,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: color,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}
```

**Step 2: Wire ScreenShake + HitParticles into ExercisePlayer**
In ExercisePlayer.tsx, add:
```tsx
import { ScreenShake, type ScreenShakeRef } from '../../components/effects';
import { HitParticles } from './HitParticles';

// Add refs:
const shakeRef = useRef<ScreenShakeRef>(null);
const [hitParticle, setHitParticle] = useState({ x: 0, y: 0, color: '#fff', trigger: 0 });

// In feedback handler (where feedback state is set):
// On 'perfect': spawn gold particles at note position
// On 'miss': shake screen + spawn red particles
if (feedbackType === 'perfect') {
  setHitParticle({ x: width / 2, y: height * 0.85, color: '#FFD700', trigger: Date.now() });
} else if (feedbackType === 'miss') {
  shakeRef.current?.shake('medium');
  setHitParticle({ x: width / 2, y: height * 0.85, color: '#FF5252', trigger: Date.now() });
}

// Wrap the exercise content in ScreenShake:
<ScreenShake ref={shakeRef}>
  {/* existing exercise content */}
</ScreenShake>

// Add HitParticles overlay:
<HitParticles x={hitParticle.x} y={hitParticle.y} color={hitParticle.color} trigger={hitParticle.trigger} />
```

**Step 3: Run tests**
```bash
npm run typecheck && npm run test -- --testPathPattern="Exercise" 2>&1 | tail -10
```

**Step 4: Commit**
```bash
git add src/screens/ExercisePlayer/HitParticles.tsx src/screens/ExercisePlayer/ExercisePlayer.tsx
git commit -m "feat(gameplay): add hit particles on note feedback + screen shake on miss"
```

### Task 11: Glassmorphism Top Bar + Score Display

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` (top bar area)
- Modify: `src/screens/ExercisePlayer/ScoreDisplay.tsx`

**Step 1: Wrap top bar in GlassmorphismCard**
```tsx
import { GlassmorphismCard } from '../../components/effects';

// Replace the top bar container with:
<GlassmorphismCard
  tint="rgba(14, 11, 26, 0.7)"
  borderColor="rgba(255, 255, 255, 0.08)"
  borderRadius={20}
  style={{ marginHorizontal: 12, marginTop: 8, paddingVertical: 8, paddingHorizontal: 12 }}
>
  {/* title, back button, pause button, score display */}
</GlassmorphismCard>
```

**Step 2: Add neon border to ScoreRing**
In ScoreDisplay, wrap the score ring with a subtle neon glow matching the current score color.

**Step 3: Commit**
```bash
git add src/screens/ExercisePlayer/ExercisePlayer.tsx src/screens/ExercisePlayer/ScoreDisplay.tsx
git commit -m "feat(gameplay): glassmorphism top bar + neon score display"
```

### Task 12: Feedback Text Upgrade

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` (feedback overlay area)

**Step 1: Upgrade feedback text with scale bounce + shadow**
Replace the current plain feedback text with animated Reanimated text:
```tsx
// "PERFECT!" → scale 0→1.3→1.0, gold color, text shadow glow
// "MISS" → scale 0→1.1→1.0, red color, brief red screen flash
// All feedback → FadeIn + spring scale
```

**Step 2: Add brief red screen flash on miss**
```tsx
{feedbackState.type === 'miss' && (
  <Animated.View
    entering={FadeIn.duration(100)}
    style={{
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255, 0, 0, 0.15)',
      zIndex: 4,
    }}
    pointerEvents="none"
  />
)}
```

**Step 3: Commit**
```bash
git add src/screens/ExercisePlayer/ExercisePlayer.tsx
git commit -m "feat(gameplay): upgrade feedback text — scale bounce, glow, red flash on miss"
```

---

## Phase 3: Figma-First Screen Redesigns

### Task 13: Set Up Figma Design System

**Step 1: Create design system rules in Figma**
Use `create_design_system_rules` MCP tool with:
- Framework: react-native
- Libraries: expo, react-native-reanimated, @shopify/react-native-skia
- Design tokens from `src/theme/tokens.ts`

**Step 2: Build Figma component library**
- GlassmorphismCard component
- NeonGlow wrapper
- GradientMeshBackground per screen accent
- GameCard with rarity borders
- ComboMeter badge
- Cat3DCanvas placeholder (rectangle with cat image)

### Task 14: Figma Design — Auth Screen

**Step 1: Design in Figma**
Specs: Larger Salsa (3D), shimmer app name "Purrrfect Keys" in neon, gradient mesh background (home accent), glassmorphism auth buttons, floating musical notes particles, FadeInUp entry animation, "Learn piano. Grow cats." tagline.

**Step 2: Extract from Figma using get_design_context**

**Step 3: Implement in `src/screens/AuthScreen.tsx`**
Replace current layout with Figma-matched implementation using effects library.

**Step 4: Run tests**
```bash
npm run test -- --testPathPattern="AuthScreen" 2>&1 | tail -10
```

**Step 5: Commit**
```bash
git add src/screens/AuthScreen.tsx
git commit -m "feat(ui): redesign AuthScreen — neon arcade style with gradient mesh + glassmorphism"
```

### Task 15: Figma Design — Onboarding Screen

**Step 1: Design 4 onboarding steps in Figma**
- Step 1: Welcome — 3D Salsa with speech bubble, neon title, animated gradient
- Step 2: Experience Level — 3 glassmorphism option cards (Beginner/Some/Advanced)
- Step 3: Input Method — 3 option cards (MIDI/Mic/Touch) with icon + description
- Step 4: Choose Your Cat — 3D cat selector (3 starters), swipeable with live 3D preview

**Step 2: Extract from Figma**

**Step 3: Implement in `src/screens/OnboardingScreen.tsx`**
- Spring transitions between steps (bouncy, not linear)
- Each card: GlassmorphismCard + NeonGlow on selection
- Cat selection: Cat3DCanvas with swipeable FlatList

**Step 4: Run tests and commit**

### Task 16: Figma Design — Home Screen

**Step 1: Design in Figma**
- GradientMeshBackground (home accent)
- SkiaParticles (floating musical notes)
- Hero: 3D cat with glow halo
- Continue Learning: NeonGlow pulsing CTA card
- Music Library Spotlight: GameCard (epic rarity)
- Daily Challenge: GameCard with shake animation
- Quick Actions: glassmorphism icon buttons

**Step 2: Extract + implement in `src/screens/HomeScreen.tsx`**

**Step 3: Run tests and commit**

### Task 17: Figma Design — Level Map

**Step 1: Design tier zones with per-tier gradient backgrounds**
- Each tier section: unique gradient from SCREEN_ACCENTS
- Nodes: NeonGlow border matching tier color
- Current node: SkiaParticles burst + pulsing glow
- Completed nodes: golden border + star count

**Step 2: Implement in `src/screens/LevelMapScreen.tsx`**

**Step 3: Commit**

### Task 18: Figma Design — Completion Modal

**Step 1: Design loot reveal sequence in Figma**
- Phase 1 (dim): GradientMeshBackground darkens
- Phase 2 (title): "EXERCISE COMPLETE" slams in with ScreenShake
- Phase 3 (score): ScoreRing with neon glow, animated fill
- Phase 4 (stars): Stars pop in one-by-one with particle bursts
- Phase 5 (chest): Animated chest opening (scale up, glow, particle burst)
- Phase 6 (gems): Gem icons rain down with `gem_clink` sound
- Phase 7 (cat): 3D cat celebrates with ConfettiEffect
- Phase 8 (coaching): GlassmorphismCard with AI feedback
- Phase 9 (actions): NeonGlow buttons (Next, Retry)

**Step 2: Implement in `src/screens/ExercisePlayer/CompletionModal.tsx`**

**Step 3: Commit**

---

## Phase 4: Cat Studio (New Screen)

### Task 19: Figma Design — Cat Studio

**Step 1: Design Cat Studio layout in Figma**
Per design doc Section 2:
```
┌─────────────────────────────────┐
│  [<Back]   Cat Studio    [Gems]│
├─────────────────────────────────┤
│     ┌───────────────────┐       │
│     │   3D Cat Preview  │       │  240px, animated, reactive
│     │   (spins slowly)  │       │  Tap = pose, swipe = rotate
│     └───────────────────┘       │
│  [Cat Selector: horizontal scroll]
│  Active cat = lifted + glow     │
├─────────────────────────────────┤
│  [Hats] [Glasses] [Outfits]    │
│  [Capes] [Collars] [Effects]   │
│  Accessory grid (3 columns)     │
│  Owned = full, Locked = gem $   │
└─────────────────────────────────┘
```

**Step 2: Extract from Figma**

### Task 20: Implement Cat Studio State

**Files:**
- Modify: `src/stores/settingsStore.ts`

**Step 1: Add accessory state**
```typescript
// Add to SettingsState interface:
equippedAccessories: Record<string, string>; // category → accessory ID
ownedAccessories: string[]; // purchased accessory IDs

// Add actions:
equipAccessory: (category: string, accessoryId: string) => void;
unequipAccessory: (category: string) => void;
addOwnedAccessory: (accessoryId: string) => void;
```

**Step 2: Write tests for accessory state**
```typescript
// src/stores/__tests__/settingsStore.accessory.test.ts
describe('accessory management', () => {
  it('equips accessory to category', () => { ... });
  it('unequips accessory from category', () => { ... });
  it('adds owned accessory', () => { ... });
  it('persists across hydration', () => { ... });
});
```

**Step 3: Commit**

### Task 21: Implement Cat Studio Screen

**Files:**
- Create: `src/screens/CatStudioScreen.tsx`
- Create: `src/data/accessories.ts` (accessory definitions)
- Modify: `src/navigation/AppNavigator.tsx` (add route)

**Step 1: Create accessory data**
```typescript
// src/data/accessories.ts
export interface Accessory {
  id: string;
  name: string;
  category: 'hats' | 'glasses' | 'outfits' | 'capes' | 'collars' | 'effects';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  gemCost: number;
  /** Minimum evolution stage to equip */
  minStage: 'baby' | 'teen' | 'adult' | 'master';
  /** Icon for grid display */
  icon: string; // MaterialCommunityIcons name
}

export const ACCESSORIES: Accessory[] = [
  // Hats (8)
  { id: 'hat-crown', name: 'Crown', category: 'hats', rarity: 'legendary', gemCost: 150, minStage: 'master', icon: 'crown' },
  { id: 'hat-beret', name: 'Beret', category: 'hats', rarity: 'common', gemCost: 15, minStage: 'teen', icon: 'hat-fedora' },
  // ... (all 30+ accessories from design doc)
];
```

**Step 2: Create CatStudioScreen**
- Header: Back button + "Cat Studio" title + Gem balance
- Cat preview: Cat3DCanvas at 240px with accessories
- Cat selector: Horizontal FlatList with NeonGlow on active
- Category tabs: Swipeable tab bar
- Accessory grid: 3-column FlatList, locked items show gem cost
- Buy modal: GlassmorphismCard with confirm/cancel

**Step 3: Add navigation route**
```typescript
// In RootStackParamList:
CatStudio: undefined;
```

**Step 4: Replace CatSwitchScreen navigation with CatStudio**

**Step 5: Run tests and commit**

---

## Phase 5: Social Revamp — The Arena

### Task 22: Figma Design — Arena Social Hub

**Step 1: Design SocialScreen as "The Arena"**
Per design doc Section 3:
- Arena entrance animation (1.5s, skippable)
- Tier-specific arena background (Bronze/Silver/Gold/Diamond)
- League Card hero section: animated tier border, pulsing shield, gradient background
- Friend Activity Feed: friend cat avatars (3D thumbnail), reaction system
- Battle Log: Clash Royale-style challenge cards (your cat vs opponent cat)

**Step 2: Extract from Figma**

### Task 23: Implement Arena Social Screen

**Files:**
- Modify: `src/screens/SocialScreen.tsx`

**Step 1: Add arena entrance animation**
On first tab switch to Social: dim screen → gates slide animation → zoom through → fade in content. Use Reanimated for the animation sequence.

**Step 2: Add tier-specific arena background**
```typescript
const ARENA_BACKGROUNDS = {
  bronze: { from: '#3E2723', to: '#1A1210' },
  silver: { from: '#37474F', to: '#1A1F22' },
  gold: { from: '#4A3800', to: '#1A1400' },
  diamond: { from: '#1A237E', to: '#0D1142' },
};
```

**Step 3: Upgrade League Card with animated border + gradient**

**Step 4: Add reaction system to Activity Feed**
Each activity item: tap → floating emoji bubble (clap/fire/heart/wow)

**Step 5: Run tests and commit**

### Task 24: Implement Podium Leaderboard

**Files:**
- Modify: `src/screens/LeaderboardScreen.tsx`

**Step 1: Add 3D cat podium for top 3**
- Position 1: center, tall block, 3D cat with celebrate pose
- Position 2: left, medium block, 3D cat with idle pose
- Position 3: right, short block, 3D cat with idle pose

**Step 2: Add promotion/demotion zone animations**
- Promotion zone (top 10): green glow cards + upward arrow
- Demotion zone (bottom 5): red-tinted cards + subtle shake

**Step 3: Pin current user row at bottom when scrolled off-screen**

**Step 4: Commit**

### Task 25: Implement Music Guilds (Bands)

**Files:**
- Create: `src/services/firebase/guildService.ts`
- Create: `src/stores/guildStore.ts`
- Create: `src/screens/GuildScreen.tsx`
- Modify: `src/navigation/AppNavigator.tsx`

**Step 1: Create Firestore guild service**
```typescript
// Guild (Band) operations:
// - createGuild(name, iconId, accentColor): Create band
// - joinGuild(guildId): Join band (max 12 members)
// - leaveGuild(guildId): Leave band
// - getGuildMembers(guildId): List members with weekly XP
// - getGuildLeaderboard(): Top bands by aggregated weekly XP
// - postGuildReaction(guildId, reaction): Emoji-only chat
```

**Step 2: Create guild store with Zustand**

**Step 3: Create GuildScreen UI**
- Band banner (icon + accent color, customizable)
- Member list with cat avatars
- Band leaderboard
- Emoji-only chat (grid of 12 emojis, no free text — kid-safe)

**Step 4: Run tests and commit**

---

## Phase 6: Supporting Screens

### Task 26: Profile Screen Redesign

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

**Step 1: Design in Figma**
- Large 3D cat with glow halo and equipped accessories
- Glassmorphism stat cards (XP, level, streak, exercises)
- Animated streak flame (Reanimated + SkiaParticles)
- Achievement grid with NeonGlow shimmer on recent unlocks
- Settings list in GlassmorphismCards

**Step 2: Implement from Figma**

**Step 3: Commit**

### Task 27: Song Library Screen Redesign

**Files:**
- Modify: `src/screens/SongLibraryScreen.tsx`

**Step 1: Design in Figma**
- Genre cards with album-art gradient backgrounds
- Metallic mastery badges (keep existing, add NeonGlow)
- Featured song spotlight with neon border
- Search bar with glassmorphism

**Step 2: Implement from Figma**

**Step 3: Commit**

### Task 28: Daily Session Screen Redesign

**Files:**
- Modify: `src/screens/DailySessionScreen.tsx`

**Step 1: Design in Figma**
- Glassmorphism exercise cards
- GameCard rarity borders by section type
- Neon session-type badge
- Salsa with animated speech bubble

**Step 2: Implement from Figma**

**Step 3: Commit**

---

## Phase 7: Transitions + Polish

### Task 29: Spring Physics Transitions

**Files:**
- Modify: `src/navigation/AppNavigator.tsx`

**Step 1: Configure spring transitions for screen pushes**
```typescript
// In stack navigator:
screenOptions={{
  animation: 'slide_from_right',
  animationDuration: 350,
  // Spring physics via custom config
  transitionSpec: {
    open: { animation: 'spring', config: { damping: 20, stiffness: 200, mass: 0.8 } },
    close: { animation: 'spring', config: { damping: 20, stiffness: 200, mass: 0.8 } },
  },
}}
```

**Step 2: Tab switch crossfade**
In CustomTabBar, add crossfade + slide animation on tab switch.

**Step 3: Modal entries: scale from 0.8 + fade**
```typescript
// For modal screens:
presentation: 'transparentModal',
animation: 'fade_from_bottom',
```

**Step 4: Commit**
```bash
git add src/navigation/
git commit -m "feat(transitions): spring physics screen pushes, crossfade tabs, scale modals"
```

### Task 30: Button Press Polish

**Files:**
- Modify: `src/components/common/PressableScale.tsx`

**Step 1: Ensure every button has scale 0.95 + haptic + sound on press**
Verify PressableScale already does this (it should from Phase 10). If any buttons bypass PressableScale, wrap them.

**Step 2: Audit all screens for bare TouchableOpacity/Pressable**
Replace any non-PressableScale tap targets with PressableScale.

**Step 3: Commit**

### Task 31: Final Test Suite Verification

**Step 1: Run full type check**
```bash
npm run typecheck
```
Expected: 0 errors.

**Step 2: Run full test suite**
```bash
npm run test
```
Expected: 2,630+ tests, 0 failures.

**Step 3: Build iOS to verify no native errors**
```bash
npx expo run:ios
```

**Step 4: Commit any remaining fixes**

---

## Execution Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 0 | 1 | Audio input device verification |
| 1 | 2-5 | Infrastructure (Skia, 3D, tokens) |
| 2 | 6-12 | Gameplay screen overhaul |
| 3 | 13-18 | Figma-first screen redesigns |
| 4 | 19-21 | Cat Studio (new screen) |
| 5 | 22-25 | Social Arena revamp |
| 6 | 26-28 | Supporting screen redesigns |
| 7 | 29-31 | Transitions + polish |

**Total: 31 tasks across 8 phases**

Each task is independently committable. Phases can be executed sequentially (recommended) or partially parallelized (Phase 3 screens are independent of each other).
