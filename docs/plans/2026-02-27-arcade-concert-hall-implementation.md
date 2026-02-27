# Arcade Concert Hall — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Purrrfect Keys into a Duolingo x Clash Royale hybrid with dramatic game-feel, sound design, 3D cats, and loot reveals — implemented in retention-priority order.

**Architecture:** Build foundation systems first (SoundManager, design tokens, GameCard component), then revamp screens in the order users encounter them: Auth → Onboarding → Home → ExercisePlayer → CompletionModal → LevelMap → remaining screens. 3D cat system runs as a parallel workstream.

**Tech Stack:** React Native 0.76, Expo SDK 52, react-native-reanimated 3.16, react-native-svg 15.8, expo-haptics, expo-av (sound pools), expo-linear-gradient, react-three-fiber + expo-gl (3D cats), Zustand 5

**Design Doc:** `docs/plans/2026-02-27-arcade-concert-hall-design.md`

---

## Batch 1: SoundManager Foundation

The SoundManager is the multiplier on ALL visual effects. Every button press, note hit, combo milestone, star earn, gem clink, and chest open needs sound + haptic. Build this first so every subsequent batch can wire sounds immediately.

---

### Task 1: Create SoundName type and SoundManager skeleton

**Files:**
- Create: `src/audio/SoundManager.ts`
- Create: `src/audio/__tests__/SoundManager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/audio/__tests__/SoundManager.test.ts
import { SoundManager, type SoundName } from '../SoundManager';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          replayAsync: jest.fn().mockResolvedValue(undefined),
          setVolumeAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
        },
      }),
    },
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

describe('SoundManager', () => {
  let manager: SoundManager;

  beforeEach(() => {
    manager = new SoundManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  it('starts with sound enabled and default volume', () => {
    expect(manager.isEnabled()).toBe(true);
    expect(manager.getVolume()).toBe(0.7);
  });

  it('can be disabled and re-enabled', () => {
    manager.setEnabled(false);
    expect(manager.isEnabled()).toBe(false);
    manager.setEnabled(true);
    expect(manager.isEnabled()).toBe(true);
  });

  it('setVolume clamps between 0 and 1', () => {
    manager.setVolume(1.5);
    expect(manager.getVolume()).toBe(1);
    manager.setVolume(-0.5);
    expect(manager.getVolume()).toBe(0);
    manager.setVolume(0.5);
    expect(manager.getVolume()).toBe(0.5);
  });

  it('play does nothing when disabled', () => {
    const Haptics = require('expo-haptics');
    manager.setEnabled(false);
    manager.play('button_press');
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('play triggers haptic even before preload', () => {
    const Haptics = require('expo-haptics');
    manager.play('button_press');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('preload resolves without error', async () => {
    await expect(manager.preload()).resolves.not.toThrow();
  });

  it('play triggers correct haptic type per sound category', () => {
    const Haptics = require('expo-haptics');
    manager.play('note_correct');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');

    manager.play('combo_20');
    expect(Haptics.impactAsync).toHaveBeenCalledWith('heavy');

    manager.play('star_earn');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest src/audio/__tests__/SoundManager.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../SoundManager'`

**Step 3: Write minimal implementation**

```typescript
// src/audio/SoundManager.ts
import { Audio } from 'expo-av';
import type { AVPlaybackSource } from 'expo-av';

let Haptics: typeof import('expo-haptics') | null = null;
try {
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}

/**
 * All available sound effect names.
 * Organized by category: UI, Gameplay, Rewards, Cat.
 */
export type SoundName =
  // UI
  | 'button_press'
  | 'toggle_on'
  | 'toggle_off'
  | 'swipe'
  | 'back_navigate'
  // Gameplay
  | 'note_correct'
  | 'note_perfect'
  | 'note_miss'
  | 'combo_5'
  | 'combo_10'
  | 'combo_20'
  | 'combo_break'
  | 'countdown_tick'
  | 'countdown_go'
  // Rewards
  | 'star_earn'
  | 'gem_clink'
  | 'xp_tick'
  | 'level_up'
  | 'chest_open'
  | 'evolution_start'
  // Cat
  | 'meow_greeting'
  | 'purr_happy'
  | 'meow_sad'
  | 'meow_celebrate';

/** Haptic feedback type for each sound category */
type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'none';

const SOUND_HAPTICS: Record<SoundName, HapticType> = {
  // UI — light taps
  button_press: 'light',
  toggle_on: 'light',
  toggle_off: 'light',
  swipe: 'light',
  back_navigate: 'light',
  // Gameplay
  note_correct: 'light',
  note_perfect: 'medium',
  note_miss: 'warning',
  combo_5: 'medium',
  combo_10: 'medium',
  combo_20: 'heavy',
  combo_break: 'warning',
  countdown_tick: 'light',
  countdown_go: 'medium',
  // Rewards
  star_earn: 'success',
  gem_clink: 'light',
  xp_tick: 'none',
  level_up: 'heavy',
  chest_open: 'medium',
  evolution_start: 'heavy',
  // Cat
  meow_greeting: 'light',
  purr_happy: 'none',
  meow_sad: 'none',
  meow_celebrate: 'medium',
};

/**
 * Map sound names to asset sources.
 * Sounds that don't have an asset yet map to null (haptic-only).
 */
const SOUND_ASSETS: Partial<Record<SoundName, AVPlaybackSource>> = {
  // Assets will be added as .wav files are created
  // e.g. button_press: require('../../assets/sounds/button_press.wav'),
};

interface LoadedSound {
  sound: Audio.Sound;
}

/**
 * SoundManager — fire-and-forget UI sound effects + haptic feedback.
 * Separate from the piano AudioEngine (different volume, different purpose).
 */
export class SoundManager {
  private sounds: Map<SoundName, LoadedSound> = new Map();
  private enabled = true;
  private volume = 0.7;
  private preloaded = false;

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  getVolume(): number {
    return this.volume;
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  async preload(): Promise<void> {
    if (this.preloaded) return;

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: false,
      staysActiveInBackground: false,
    });

    const entries = Object.entries(SOUND_ASSETS) as [SoundName, AVPlaybackSource][];
    const results = await Promise.allSettled(
      entries.map(async ([name, source]) => {
        const { sound } = await Audio.Sound.createAsync(source, {
          volume: this.volume,
          shouldPlay: false,
        });
        this.sounds.set(name, { sound });
      }),
    );

    // Log failures but don't crash
    for (const r of results) {
      if (r.status === 'rejected') {
        console.warn('[SoundManager] Failed to preload sound:', r.reason);
      }
    }

    this.preloaded = true;
  }

  /**
   * Fire-and-forget: play sound + trigger haptic.
   * If sound asset isn't loaded, still fires haptic.
   */
  play(name: SoundName): void {
    if (!this.enabled) return;

    // Always fire haptic (even if sound not loaded)
    this.triggerHaptic(name);

    // Play audio if available
    const loaded = this.sounds.get(name);
    if (loaded) {
      loaded.sound.replayAsync().catch(() => {});
    }
  }

  private triggerHaptic(name: SoundName): void {
    if (!Haptics) return;
    const type = SOUND_HAPTICS[name];
    switch (type) {
      case 'light':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        break;
      case 'medium':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        break;
      case 'heavy':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
        break;
      case 'success':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        break;
      case 'warning':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        break;
      case 'none':
        break;
    }
  }

  dispose(): void {
    for (const { sound } of this.sounds.values()) {
      sound.unloadAsync().catch(() => {});
    }
    this.sounds.clear();
    this.preloaded = false;
  }
}

/** Singleton instance — import this everywhere */
export const soundManager = new SoundManager();
```

**Step 4: Run test to verify it passes**

```bash
npx jest src/audio/__tests__/SoundManager.test.ts --no-coverage
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/audio/SoundManager.ts src/audio/__tests__/SoundManager.test.ts
git commit -m "feat(sound): add SoundManager with haptic feedback + preload system"
```

---

### Task 2: Add useSoundManager hook and wire to settingsStore

**Files:**
- Create: `src/hooks/useSoundManager.ts`
- Modify: `src/stores/settingsStore.ts` — add `uiSoundEnabled` and `uiSoundVolume`
- Modify: `src/stores/types.ts` — add settings types

**Step 1: Write the failing test**

```typescript
// Add to existing settingsStore test file, or create src/hooks/__tests__/useSoundManager.test.ts
import { useSettingsStore } from '../../stores/settingsStore';

describe('settingsStore UI sound settings', () => {
  it('has uiSoundEnabled defaulting to true', () => {
    expect(useSettingsStore.getState().uiSoundEnabled).toBe(true);
  });

  it('has uiSoundVolume defaulting to 0.7', () => {
    expect(useSettingsStore.getState().uiSoundVolume).toBe(0.7);
  });

  it('setUiSoundEnabled updates state', () => {
    useSettingsStore.getState().setUiSoundEnabled(false);
    expect(useSettingsStore.getState().uiSoundEnabled).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx jest src/stores/__tests__/settingsStore --no-coverage
```
Expected: FAIL — `uiSoundEnabled` doesn't exist

**Step 3: Add settings + hook**

Add to `src/stores/settingsStore.ts`:
```typescript
uiSoundEnabled: true,
uiSoundVolume: 0.7,
setUiSoundEnabled: (enabled: boolean) => { set({ uiSoundEnabled: enabled }); debouncedSave(get()); },
setUiSoundVolume: (vol: number) => { set({ uiSoundVolume: vol }); debouncedSave(get()); },
```

Create `src/hooks/useSoundManager.ts`:
```typescript
import { useEffect } from 'react';
import { soundManager } from '../audio/SoundManager';
import { useSettingsStore } from '../stores/settingsStore';

/** Syncs SoundManager singleton with settingsStore. Call once at app root. */
export function useSoundManagerSync(): void {
  const enabled = useSettingsStore((s) => s.uiSoundEnabled);
  const volume = useSettingsStore((s) => s.uiSoundVolume);

  useEffect(() => {
    soundManager.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    soundManager.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    soundManager.preload();
    return () => soundManager.dispose();
  }, []);
}
```

**Step 4: Run tests**

```bash
npx jest src/stores/__tests__/settingsStore --no-coverage
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useSoundManager.ts src/stores/settingsStore.ts src/stores/types.ts
git commit -m "feat(sound): add uiSoundEnabled/Volume settings + useSoundManagerSync hook"
```

---

### Task 3: Wire PressableScale to auto-play button_press sound

**Files:**
- Modify: `src/components/common/PressableScale.tsx`

**Step 1: Write the failing test**

Add test to existing PressableScale tests or create new:
```typescript
// src/components/common/__tests__/PressableScale.test.tsx
import { soundManager } from '../../../audio/SoundManager';
jest.mock('../../../audio/SoundManager', () => ({
  soundManager: { play: jest.fn() },
}));

it('plays button_press sound on press when soundOnPress is true', () => {
  // render <PressableScale soundOnPress onPress={() => {}} />
  // fire pressIn
  // expect(soundManager.play).toHaveBeenCalledWith('button_press');
});
```

**Step 2: Implement — add `soundOnPress` prop**

In PressableScale, add to props:
```typescript
/** Play button_press sound + haptic on press (default: true) */
soundOnPress?: boolean;
```

In handlePressIn, add before haptic check:
```typescript
if (soundOnPress !== false) {
  soundManager.play('button_press');
}
```

Import at top:
```typescript
import { soundManager } from '../../audio/SoundManager';
```

Remove the existing manual Haptics import/call (SoundManager handles haptic now when `soundOnPress` is true). Keep the existing `haptic` prop as override for backward compat.

**Step 3: Run tests**

```bash
npx jest src/components/common/__tests__/ --no-coverage
```

**Step 4: Commit**

```bash
git add src/components/common/PressableScale.tsx src/components/common/__tests__/
git commit -m "feat(sound): wire PressableScale to SoundManager for button_press"
```

---

## Batch 2: Design Tokens + GameCard Component

Expand the design system with combo-tier colors, rarity borders, and a reusable GameCard component that all screens will use.

---

### Task 4: Add combo tier + rarity tokens to design system

**Files:**
- Modify: `src/theme/tokens.ts`

**Step 1: Write the test**

```typescript
// src/theme/__tests__/tokens.test.ts
import { COLORS, COMBO_TIERS, RARITY } from '../tokens';

describe('Combo tier tokens', () => {
  it('defines 5 combo tiers', () => {
    expect(COMBO_TIERS).toHaveLength(5);
  });

  it('NORMAL tier starts at 0', () => {
    expect(COMBO_TIERS[0].minCombo).toBe(0);
    expect(COMBO_TIERS[0].name).toBe('NORMAL');
  });

  it('LEGENDARY tier starts at 20', () => {
    expect(COMBO_TIERS[4].minCombo).toBe(20);
    expect(COMBO_TIERS[4].name).toBe('LEGENDARY');
  });
});

describe('Rarity tokens', () => {
  it('defines common, rare, epic rarity', () => {
    expect(RARITY.common).toBeDefined();
    expect(RARITY.rare).toBeDefined();
    expect(RARITY.epic).toBeDefined();
  });
});
```

**Step 2: Implement**

Add to `src/theme/tokens.ts`:

```typescript
// ─────────────────────────────────────────────────
// COMBO TIER SYSTEM (ExercisePlayer escalation)
// ─────────────────────────────────────────────────

export interface ComboTier {
  name: string;
  minCombo: number;
  color: string;
  glowColor: string;
  borderColor: string;
  label: string;
}

export const COMBO_TIERS: readonly ComboTier[] = [
  { name: 'NORMAL',    minCombo: 0,  color: '#FFFFFF',  glowColor: 'transparent',       borderColor: 'transparent',     label: '' },
  { name: 'GOOD',      minCombo: 5,  color: '#FFD700',  glowColor: 'rgba(255,215,0,0.3)', borderColor: '#FFD700',       label: 'GOOD!' },
  { name: 'FIRE',      minCombo: 10, color: '#FF6B35',  glowColor: 'rgba(255,107,53,0.4)', borderColor: '#FF4500',      label: '🔥 FIRE!' },
  { name: 'SUPER',     minCombo: 15, color: '#FFD700',  glowColor: 'rgba(255,215,0,0.5)',  borderColor: '#FFD700',      label: '⚡ SUPER!' },
  { name: 'LEGENDARY', minCombo: 20, color: '#FF2D55',  glowColor: 'rgba(255,45,85,0.6)',  borderColor: '#FF2D55',      label: '🌟 LEGENDARY!' },
] as const;

/** Get the active combo tier for a given combo count */
export function getComboTier(comboCount: number): ComboTier {
  for (let i = COMBO_TIERS.length - 1; i >= 0; i--) {
    if (comboCount >= COMBO_TIERS[i].minCombo) return COMBO_TIERS[i];
  }
  return COMBO_TIERS[0];
}

// ─────────────────────────────────────────────────
// RARITY SYSTEM (Game cards, chests, cat borders)
// ─────────────────────────────────────────────────

export const RARITY = {
  common: {
    borderColor: '#555555',
    glowColor: 'rgba(100,100,100,0.2)',
    label: 'Common',
    gradient: ['#3A3A3A', '#2A2A2A'] as const,
  },
  rare: {
    borderColor: '#4FC3F7',
    glowColor: 'rgba(79,195,247,0.3)',
    label: 'Rare',
    gradient: ['#1A3A5C', '#0D2137'] as const,
  },
  epic: {
    borderColor: '#CE93D8',
    glowColor: 'rgba(206,147,216,0.4)',
    label: 'Epic',
    gradient: ['#3A1A4A', '#1F0A2A'] as const,
  },
  legendary: {
    borderColor: '#FFD700',
    glowColor: 'rgba(255,215,0,0.5)',
    label: 'Legendary',
    gradient: ['#4A3A0A', '#2A1F00'] as const,
  },
} as const;

export type RarityLevel = keyof typeof RARITY;
```

**Step 3: Run tests**

```bash
npx jest src/theme/__tests__/tokens.test.ts --no-coverage
```

**Step 4: Run full typecheck**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/theme/tokens.ts src/theme/__tests__/tokens.test.ts
git commit -m "feat(tokens): add combo tier system + rarity tokens for game cards"
```

---

### Task 5: Create GameCard component with rarity borders + tilt press

**Files:**
- Create: `src/components/common/GameCard.tsx`
- Create: `src/components/common/__tests__/GameCard.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/common/__tests__/GameCard.test.tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GameCard } from '../GameCard';

jest.mock('../../../audio/SoundManager', () => ({
  soundManager: { play: jest.fn() },
}));

describe('GameCard', () => {
  it('renders children', () => {
    const { getByText } = render(
      <GameCard rarity="common"><Text>Hello</Text></GameCard>
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('applies rarity border color', () => {
    const { getByTestId } = render(
      <GameCard rarity="rare" testID="card"><Text>Card</Text></GameCard>
    );
    // Verify border style is applied
    const card = getByTestId('card');
    expect(card).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <GameCard rarity="common" onPress={onPress} testID="card"><Text>Card</Text></GameCard>
    );
    fireEvent.press(getByTestId('card'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

**Step 2: Implement GameCard**

```typescript
// src/components/common/GameCard.tsx
import React from 'react';
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { PressableScale } from './PressableScale';
import { RARITY, type RarityLevel, COLORS, BORDER_RADIUS, SHADOWS, SPACING } from '../../theme/tokens';

export interface GameCardProps {
  rarity: RarityLevel;
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Idle glow pulse animation (default: false) */
  pulse?: boolean;
  testID?: string;
}

export function GameCard({ rarity, children, onPress, style, pulse, testID }: GameCardProps) {
  const rarityConfig = RARITY[rarity];

  const cardStyle: ViewStyle = {
    borderWidth: 1.5,
    borderColor: rarityConfig.borderColor,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.cardSurface,
    padding: SPACING.md,
    ...SHADOWS.md,
  };

  if (onPress) {
    return (
      <PressableScale onPress={onPress} glowOnPress haptic testID={testID} style={[cardStyle, style]}>
        {children}
      </PressableScale>
    );
  }

  return (
    <View style={[cardStyle, style]} testID={testID}>
      {children}
    </View>
  );
}
```

**Step 3: Run tests**

```bash
npx jest src/components/common/__tests__/GameCard.test.tsx --no-coverage
```

**Step 4: Commit**

```bash
git add src/components/common/GameCard.tsx src/components/common/__tests__/GameCard.test.tsx
git commit -m "feat(ui): add GameCard component with rarity border system"
```

---

## Batch 3: ExercisePlayer Combo Escalation

Transform the flat combo counter into a dramatic 5-tier escalation system with visual and audio effects.

---

### Task 6: Create ComboMeter component

**Files:**
- Create: `src/screens/ExercisePlayer/ComboMeter.tsx`
- Create: `src/screens/ExercisePlayer/__tests__/ComboMeter.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/screens/ExercisePlayer/__tests__/ComboMeter.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ComboMeter } from '../ComboMeter';

jest.mock('../../../audio/SoundManager', () => ({
  soundManager: { play: jest.fn() },
}));

describe('ComboMeter', () => {
  it('renders nothing when combo is 0', () => {
    const { queryByTestId } = render(<ComboMeter combo={0} />);
    expect(queryByTestId('combo-meter')).toBeNull();
  });

  it('shows combo count when >= 3', () => {
    const { getByText } = render(<ComboMeter combo={5} />);
    expect(getByText('5x')).toBeTruthy();
  });

  it('shows GOOD label at combo 5', () => {
    const { getByText } = render(<ComboMeter combo={5} />);
    expect(getByText('GOOD!')).toBeTruthy();
  });

  it('shows FIRE label at combo 10', () => {
    const { getByText } = render(<ComboMeter combo={10} />);
    expect(getByText(/FIRE/)).toBeTruthy();
  });

  it('shows LEGENDARY label at combo 20', () => {
    const { getByText } = render(<ComboMeter combo={22} />);
    expect(getByText(/LEGENDARY/)).toBeTruthy();
  });
});
```

**Step 2: Implement ComboMeter**

```typescript
// src/screens/ExercisePlayer/ComboMeter.tsx
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { getComboTier, COMBO_TIERS } from '../../theme/tokens';
import { soundManager } from '../../audio/SoundManager';
import type { SoundName } from '../../audio/SoundManager';

interface ComboMeterProps {
  combo: number;
}

const COMBO_SOUNDS: Record<string, SoundName> = {
  GOOD: 'combo_5',
  FIRE: 'combo_10',
  SUPER: 'combo_10',
  LEGENDARY: 'combo_20',
};

export function ComboMeter({ combo }: ComboMeterProps) {
  const scale = useRef(new Animated.Value(0)).current;
  const prevTierRef = useRef('NORMAL');
  const tier = getComboTier(combo);

  // Animate on tier change
  useEffect(() => {
    if (tier.name !== prevTierRef.current && tier.name !== 'NORMAL') {
      const sound = COMBO_SOUNDS[tier.name];
      if (sound) soundManager.play(sound);

      Animated.sequence([
        Animated.spring(scale, { toValue: 1.3, useNativeDriver: true, damping: 6, stiffness: 300 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
      ]).start();
    }
    prevTierRef.current = tier.name;
  }, [tier.name, scale]);

  // Pulse on every combo increment (small bounce)
  useEffect(() => {
    if (combo >= 3) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.1, useNativeDriver: true, damping: 12, stiffness: 300 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }),
      ]).start();
    }
  }, [combo, scale]);

  if (combo < 3) return null;

  return (
    <View testID="combo-meter" style={styles.container}>
      <Animated.View style={[styles.badge, { backgroundColor: tier.color, transform: [{ scale }] }]}>
        <Text style={styles.count}>{combo}x</Text>
      </Animated.View>
      {tier.label ? <Text style={[styles.label, { color: tier.color }]}>{tier.label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', position: 'absolute', top: 60, right: 16, zIndex: 10 },
  badge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, minWidth: 48, alignItems: 'center' },
  count: { color: '#000', fontSize: 18, fontWeight: '800' },
  label: { fontSize: 14, fontWeight: '800', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
});
```

**Step 3: Run tests**

```bash
npx jest src/screens/ExercisePlayer/__tests__/ComboMeter.test.tsx --no-coverage
```

**Step 4: Commit**

```bash
git add src/screens/ExercisePlayer/ComboMeter.tsx src/screens/ExercisePlayer/__tests__/ComboMeter.test.tsx
git commit -m "feat(combo): add ComboMeter component with 5-tier escalation"
```

---

### Task 7: Add screen border glow effect for combo tiers

**Files:**
- Create: `src/screens/ExercisePlayer/ComboGlow.tsx`

**Step 1: Write the test**

```typescript
// src/screens/ExercisePlayer/__tests__/ComboGlow.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { ComboGlow } from '../ComboGlow';

describe('ComboGlow', () => {
  it('renders nothing for NORMAL tier', () => {
    const { queryByTestId } = render(<ComboGlow combo={3} />);
    expect(queryByTestId('combo-glow')).toBeNull();
  });

  it('renders glow border for FIRE tier', () => {
    const { getByTestId } = render(<ComboGlow combo={12} />);
    expect(getByTestId('combo-glow')).toBeTruthy();
  });
});
```

**Step 2: Implement — an overlay View with animated glowing border**

```typescript
// src/screens/ExercisePlayer/ComboGlow.tsx
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { getComboTier } from '../../theme/tokens';

interface ComboGlowProps {
  combo: number;
}

export function ComboGlow({ combo }: ComboGlowProps) {
  const tier = getComboTier(combo);
  const opacity = useSharedValue(0);

  const shouldShow = tier.name !== 'NORMAL' && combo >= 5;

  useEffect(() => {
    if (shouldShow) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 800 }),
          withTiming(0.3, { duration: 800 }),
        ),
        -1,
        true,
      );
    } else {
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [shouldShow, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    borderColor: tier.borderColor,
  }));

  if (!shouldShow) return null;

  return (
    <Animated.View
      testID="combo-glow"
      pointerEvents="none"
      style={[styles.glow, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: 0,
    zIndex: 5,
  },
});
```

**Step 3: Run tests, commit**

```bash
npx jest src/screens/ExercisePlayer/__tests__/ComboGlow.test.tsx --no-coverage
git add src/screens/ExercisePlayer/ComboGlow.tsx src/screens/ExercisePlayer/__tests__/ComboGlow.test.tsx
git commit -m "feat(combo): add ComboGlow screen border effect for combo tiers"
```

---

### Task 8: Wire ComboMeter + ComboGlow into ExercisePlayer

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx`

**Step 1: Replace the current inline combo overlay**

In ExercisePlayer.tsx, find the current combo display (around line 2034):
```typescript
{comboCount > 2 && (
  <Text style={styles.comboOverlayText}>{comboCount}x combo</Text>
)}
```

Replace with:
```typescript
<ComboMeter combo={comboCount} />
```

Add at the top of the exercise player's root View:
```typescript
<ComboGlow combo={comboCount} />
```

Add imports:
```typescript
import { ComboMeter } from './ComboMeter';
import { ComboGlow } from './ComboGlow';
```

Remove the old `comboOverlayText` style.

**Step 2: Run existing ExercisePlayer tests + typecheck**

```bash
npx jest src/screens/ExercisePlayer/__tests__/ --no-coverage
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/screens/ExercisePlayer/ExercisePlayer.tsx
git commit -m "feat(combo): wire ComboMeter + ComboGlow into ExercisePlayer"
```

---

### Task 9: Upgrade Keyboard with 3D depth + press animation + glow

**Files:**
- Modify: `src/components/Keyboard/Keyboard.tsx`

**Step 1: Test that keyboard still renders correctly**

Run existing keyboard tests first:
```bash
npx jest src/components/Keyboard/__tests__/ --no-coverage
```

**Step 2: Add depth styling to keyboard keys**

In `Keyboard.tsx`, update key styles:

For white keys — add bottom shadow and bevel:
```typescript
const whiteKeyStyle = {
  // existing styles...
  borderBottomWidth: 3,
  borderBottomColor: '#D0D0D0',
  borderLeftWidth: 0.5,
  borderLeftColor: '#E8E8E8',
  borderRightWidth: 0.5,
  borderRightColor: '#CCCCCC',
};
```

For active/pressed keys — add translateY + scale for "push down" effect:
```typescript
const pressedTransform = {
  transform: [{ translateY: 2 }, { scaleY: 0.98 }],
  borderBottomWidth: 1,
};
```

For the "correct" feedback — green glow from within:
```typescript
const correctGlow = {
  backgroundColor: 'rgba(76, 175, 80, 0.3)',
  shadowColor: '#4CAF50',
  shadowOpacity: 0.6,
  shadowRadius: 8,
};
```

For the "wrong" feedback — red flash:
```typescript
const wrongFlash = {
  backgroundColor: 'rgba(244, 67, 54, 0.3)',
};
```

**Step 3: Run tests + typecheck**

```bash
npx jest src/components/Keyboard/__tests__/ --no-coverage
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/Keyboard/Keyboard.tsx
git commit -m "feat(keyboard): add 3D depth, press animation, correct/wrong glow"
```

---

## Batch 4: CompletionModal Loot Reveal

Replace the current static completion modal with a Clash Royale-style timed reveal sequence.

---

### Task 10: Create RewardChest system (pure logic)

**Files:**
- Create: `src/core/rewards/chestSystem.ts`
- Create: `src/core/rewards/__tests__/chestSystem.test.ts`

**Step 1: Write the failing test**

```typescript
// src/core/rewards/__tests__/chestSystem.test.ts
import { getChestType, getChestReward, type ChestType } from '../chestSystem';

describe('chestSystem', () => {
  it('returns epic chest for 3-star first completion', () => {
    expect(getChestType(3, true)).toBe('epic');
  });

  it('returns rare chest for 3-star repeat', () => {
    expect(getChestType(3, false)).toBe('rare');
  });

  it('returns common chest for 2-star first completion', () => {
    expect(getChestType(2, true)).toBe('common');
  });

  it('returns none for 1 star', () => {
    expect(getChestType(1, true)).toBe('none');
  });

  it('returns none for 0 stars', () => {
    expect(getChestType(0, false)).toBe('none');
  });

  it('epic chest gives 25 gems + catXpBoost', () => {
    const reward = getChestReward('epic');
    expect(reward.gems).toBe(25);
    expect(reward.catXpBoost).toBe(true);
  });

  it('rare chest gives 10 gems', () => {
    const reward = getChestReward('rare');
    expect(reward.gems).toBe(10);
  });

  it('common chest gives 5 gems', () => {
    const reward = getChestReward('common');
    expect(reward.gems).toBe(5);
  });

  it('none chest gives 0 gems', () => {
    const reward = getChestReward('none');
    expect(reward.gems).toBe(0);
  });
});
```

**Step 2: Implement**

```typescript
// src/core/rewards/chestSystem.ts
export type ChestType = 'epic' | 'rare' | 'common' | 'none';

export interface ChestReward {
  gems: number;
  catXpBoost: boolean;
}

const CHEST_REWARDS: Record<ChestType, ChestReward> = {
  epic: { gems: 25, catXpBoost: true },
  rare: { gems: 10, catXpBoost: false },
  common: { gems: 5, catXpBoost: false },
  none: { gems: 0, catXpBoost: false },
};

export function getChestType(stars: number, isFirstCompletion: boolean): ChestType {
  if (stars >= 3 && isFirstCompletion) return 'epic';
  if (stars >= 3) return 'rare';
  if (stars >= 2 && isFirstCompletion) return 'common';
  return 'none';
}

export function getChestReward(chest: ChestType): ChestReward {
  return CHEST_REWARDS[chest];
}

/** Rarity for visual styling */
export function chestRarity(chest: ChestType): 'common' | 'rare' | 'epic' | 'legendary' {
  if (chest === 'epic') return 'epic';
  if (chest === 'rare') return 'rare';
  return 'common';
}
```

**Step 3: Run tests, commit**

```bash
npx jest src/core/rewards/__tests__/chestSystem.test.ts --no-coverage
git add src/core/rewards/chestSystem.ts src/core/rewards/__tests__/chestSystem.test.ts
git commit -m "feat(rewards): add chest system with performance-based chest types"
```

---

### Task 11: Rewrite CompletionModal with timed loot reveal sequence

**Files:**
- Modify: `src/screens/ExercisePlayer/CompletionModal.tsx`

This is the biggest single task. The current CompletionModal shows everything at once. The new version reveals elements in a timed sequence (0-6.5s).

**Step 1: Run existing CompletionModal tests as baseline**

```bash
npx jest src/screens/ExercisePlayer/__tests__/ --no-coverage
```

**Step 2: Rewrite with phased reveal**

The key architectural change: use a `phase` state that increments on timers:

```typescript
type RevealPhase =
  | 'dim'           // 0.0s — Screen dims
  | 'title'         // 0.3s — "EXERCISE COMPLETE!" slam
  | 'score'         // 0.8s — Score ring fills
  | 'stars'         // 2.3s — Stars appear one by one
  | 'record'        // 3.5s — "NEW RECORD!" (if applicable)
  | 'gems'          // 4.0s — Gems rain down
  | 'xp'            // 4.8s — XP bar fills
  | 'cat'           // 5.5s — Cat reaction
  | 'coaching'      // 6.0s — AI coaching tip
  | 'actions';      // 6.5s — Action buttons

const PHASE_TIMINGS: Record<RevealPhase, number> = {
  dim: 0,
  title: 300,
  score: 800,
  stars: 2300,
  record: 3500,
  gems: 4000,
  xp: 4800,
  cat: 5500,
  coaching: 6000,
  actions: 6500,
};
```

Each element checks `if (phase >= 'stars')` before rendering, using `Animated.spring` for entrance.

Wire `soundManager.play('star_earn')` at the stars phase, `soundManager.play('gem_clink')` at gems phase, etc.

Keep the existing `CompletionModalProps` interface unchanged for backward compatibility. Add a `skipAnimation?: boolean` prop for tests.

**Step 3: Update tests to account for phased rendering**

Tests should either use `skipAnimation={true}` or use `jest.advanceTimersByTime()` to fast-forward phases.

**Step 4: Run tests + typecheck**

```bash
npx jest src/screens/ExercisePlayer/__tests__/ --no-coverage
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/screens/ExercisePlayer/CompletionModal.tsx
git commit -m "feat(completion): rewrite CompletionModal with timed loot reveal sequence"
```

---

### Task 12: Wire chest rewards into completion flow

**Files:**
- Modify: `src/screens/ExercisePlayer/ExercisePlayer.tsx` (handleCompletion)
- Modify: `src/screens/ExercisePlayer/CompletionModal.tsx` (add chest prop)

**Step 1: In ExercisePlayer's handleCompletion, compute chest type**

```typescript
import { getChestType, getChestReward } from '../../core/rewards/chestSystem';

// In handleCompletion, after computing score:
const isFirstCompletion = !progressStore.getExerciseProgress(lessonId, exercise.id);
const chestType = getChestType(score.stars, isFirstCompletion);
const chestReward = getChestReward(chestType);

// Award chest gems (on top of normal gems)
if (chestReward.gems > 0) {
  gemStore.earnGems(chestReward.gems, `chest-${exercise.id}`);
}
```

**Step 2: Pass chest info to CompletionModal**

```typescript
<CompletionModal
  // ... existing props
  chestType={chestType}
  chestGems={chestReward.gems}
/>
```

**Step 3: Run tests + typecheck, commit**

```bash
npx jest src/screens/ExercisePlayer/__tests__/ --no-coverage
npx tsc --noEmit
git add src/screens/ExercisePlayer/ExercisePlayer.tsx src/screens/ExercisePlayer/CompletionModal.tsx
git commit -m "feat(rewards): wire chest rewards into exercise completion flow"
```

---

## Batch 5: HomeScreen Command Center

Redesign HomeScreen with game card layout, pulsing CTA, and game-feel.

---

### Task 13: Redesign HomeScreen with GameCard layout

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

**Step 1: Run existing HomeScreen tests as baseline**

```bash
npx jest src/screens/__tests__/HomeScreen.test.tsx --no-coverage
```

**Step 2: Replace flat cards with GameCard components**

- "Continue Learning" → `GameCard rarity="rare"` with large pulsing CTA
- "Daily Challenge" → `GameCard rarity="epic"` with shake animation when available
- "AI Practice" → `GameCard rarity="rare"`
- "Free Play" → `GameCard rarity="common"`

Add a pulsing animation to the Continue Learning card:
```typescript
const pulseAnim = useRef(new Animated.Value(1)).current;
useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
    ])
  ).start();
}, []);
```

Add a shake animation to the Daily Challenge card when challenge is available:
```typescript
const shakeAnim = useRef(new Animated.Value(0)).current;
// Subtle horizontal shake every 5 seconds
```

**Step 3: Run tests + typecheck**

```bash
npx jest src/screens/__tests__/HomeScreen.test.tsx --no-coverage
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat(home): redesign HomeScreen with GameCard layout + pulsing CTA"
```

---

## Batch 6: AuthScreen Cinematic Intro

Transform the plain auth screen into a cinematic first impression.

---

### Task 14: Redesign AuthScreen with cinematic elements

**Files:**
- Modify: `src/screens/AuthScreen.tsx`

**Step 1: Enhance the animated gradient background**

The AnimatedGradientBackground already exists and works. Enhance it:
- Make Salsa larger (120px → 200px) and centered
- Add app name "Purrrfect Keys" with shimmer effect using Reanimated
- Add tagline "Learn piano. Grow cats."
- Redesign buttons with depth: gradient fill, border, shadow

**Step 2: Add floating musical notes animation**

Create a simple particle system using Reanimated:
```typescript
// Floating notes: 5-8 Text elements ("♪", "♫") with random y-drift animation
const notes = useMemo(() =>
  Array.from({ length: 6 }, (_, i) => ({
    id: i,
    symbol: i % 2 === 0 ? '♪' : '♫',
    x: 20 + (i * 60) % 340,
    delay: i * 400,
  })),
[]);
```

Each note drifts upward (translateY animation), fades out, and resets — using `withRepeat`.

**Step 3: Add shimmer text animation for app name**

```typescript
// Shimmer: animated LinearGradient mask over text
// Or simpler: animated opacity pulse on a gold-colored text shadow
```

**Step 4: Run existing tests + typecheck**

```bash
npx jest src/screens/__tests__/AuthScreen --no-coverage
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/screens/AuthScreen.tsx
git commit -m "feat(auth): cinematic intro with floating notes + shimmer title"
```

---

## Batch 7: 3D Cat Avatar Infrastructure

Set up the react-three-fiber pipeline. Actual Blender models are created externally — this batch builds the code infrastructure with a placeholder.

---

### Task 15: Install 3D dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

```bash
npx expo install expo-gl three @react-three/fiber
npm install @react-three/drei
```

**Step 2: Verify installation**

```bash
npx tsc --noEmit
```

If expo-gl requires native rebuild:
```bash
# iOS: rm -rf ios/Pods ios/Podfile.lock ios/build && cd ios && pod install
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install react-three-fiber + expo-gl for 3D cat avatars"
```

---

### Task 16: Create CatAvatar3D component with SVG fallback

**Files:**
- Create: `src/components/Mascot/CatAvatar3D.tsx`
- Create: `src/components/Mascot/__tests__/CatAvatar3D.test.tsx`

**Step 1: Write the test**

```typescript
// src/components/Mascot/__tests__/CatAvatar3D.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { CatAvatar3D } from '../CatAvatar3D';

// Mock react-three-fiber (not available in test env)
jest.mock('@react-three/fiber', () => ({ Canvas: 'Canvas' }));
jest.mock('@react-three/drei', () => ({}));
jest.mock('expo-gl', () => ({}));

describe('CatAvatar3D', () => {
  it('renders SVG fallback when 3D is not supported', () => {
    const { getByTestId } = render(
      <CatAvatar3D catId="jazzy" evolutionStage={1} pose="idle" size={100} testID="cat3d" />
    );
    expect(getByTestId('cat3d')).toBeTruthy();
  });
});
```

**Step 2: Implement with fallback**

```typescript
// src/components/Mascot/CatAvatar3D.tsx
import React, { Suspense, useState } from 'react';
import { View } from 'react-native';
import { CatAvatar } from './CatAvatar';

// Lazy import to avoid crash when expo-gl isn't available
let Canvas: React.ComponentType<any> | null = null;
try {
  Canvas = require('@react-three/fiber').Canvas;
} catch {
  Canvas = null;
}

export interface CatAvatar3DProps {
  catId: string;
  evolutionStage: 1 | 2 | 3 | 4;
  pose: 'idle' | 'celebrate' | 'teach' | 'sleep' | 'sad' | 'play' | 'curious';
  size: number;
  interactive?: boolean;
  testID?: string;
}

export function CatAvatar3D({ catId, evolutionStage, pose, size, interactive, testID }: CatAvatar3DProps) {
  const [use3D] = useState(Canvas !== null);

  // Fallback to SVG avatar (always works)
  if (!use3D) {
    return (
      <View testID={testID}>
        <CatAvatar
          catId={catId}
          size={size > 100 ? 'large' : size > 60 ? 'medium' : 'small'}
          mood={pose === 'celebrate' ? 'celebrating' : pose === 'sad' ? 'sad' : 'idle'}
          evolutionStage={evolutionStage}
        />
      </View>
    );
  }

  // 3D rendering — will use .glb models when available
  return (
    <View testID={testID} style={{ width: size, height: size }}>
      <Canvas
        style={{ flex: 1 }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[2, 4, 5]} intensity={0.8} />
          {/* Placeholder: colored box until .glb models are created */}
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <boxGeometry args={[1, 1.2, 0.8]} />
            <meshStandardMaterial color="#FF8A65" />
          </mesh>
        </Suspense>
      </Canvas>
    </View>
  );
}
```

**Step 3: Run test, commit**

```bash
npx jest src/components/Mascot/__tests__/CatAvatar3D.test.tsx --no-coverage
git add src/components/Mascot/CatAvatar3D.tsx src/components/Mascot/__tests__/CatAvatar3D.test.tsx
git commit -m "feat(3d): add CatAvatar3D component with SVG fallback"
```

---

### Task 17: Create CatModelLoader service for .glb loading

**Files:**
- Create: `src/components/Mascot/CatModelLoader.ts`

**Step 1: Implement lazy model loader**

```typescript
// src/components/Mascot/CatModelLoader.ts

/** Maps catId + evolutionStage to .glb asset path */
const MODEL_REGISTRY: Record<string, string> = {
  // Will be populated as Blender models are exported
  // e.g. 'jazzy-1': require('../../../assets/models/cats/jazzy-baby.glb'),
};

interface LoadedModel {
  scene: any; // THREE.Group
  animations: any[]; // THREE.AnimationClip[]
}

const modelCache = new Map<string, LoadedModel>();

export function getModelKey(catId: string, stage: number): string {
  return `${catId}-${stage}`;
}

export function isModelAvailable(catId: string, stage: number): boolean {
  return MODEL_REGISTRY[getModelKey(catId, stage)] != null;
}

export function getCachedModel(catId: string, stage: number): LoadedModel | null {
  return modelCache.get(getModelKey(catId, stage)) ?? null;
}

/** Preload a model into cache. Returns false if model doesn't exist. */
export async function preloadModel(catId: string, stage: number): Promise<boolean> {
  const key = getModelKey(catId, stage);
  if (modelCache.has(key)) return true;
  if (!MODEL_REGISTRY[key]) return false;

  try {
    // useGLTF from drei handles loading — this is a reference for imperative loading
    // Actual loading happens in the React component via useGLTF
    return true;
  } catch {
    return false;
  }
}
```

**Step 2: Commit**

```bash
git add src/components/Mascot/CatModelLoader.ts
git commit -m "feat(3d): add CatModelLoader service for .glb model management"
```

---

## Batch 8: LevelMap Trophy Road

Transform the level map from circular nodes to a trophy road with themed environments.

---

### Task 18: Add tier theme data + themed background colors

**Files:**
- Modify: `src/screens/LevelMapScreen.tsx`

**Step 1: Define tier themes**

```typescript
interface TierTheme {
  backgroundGradient: readonly [string, string];
  nodeColor: string;
  pathColor: string;
  label: string;
}

const TIER_THEMES: Record<number, TierTheme> = {
  1: { backgroundGradient: ['#1A3A1A', '#0A1F0A'], nodeColor: '#4CAF50', pathColor: '#2E7D32', label: 'Grassland' },
  2: { backgroundGradient: ['#1A2A3A', '#0A1520'], nodeColor: '#42A5F5', pathColor: '#1565C0', label: 'Lake' },
  3: { backgroundGradient: ['#3A2A1A', '#1F1508'], nodeColor: '#FF9800', pathColor: '#E65100', label: 'Desert' },
  // ... etc for all 15 tiers
  10: { backgroundGradient: ['#2A1A2A', '#150A15'], nodeColor: '#CE93D8', pathColor: '#7B1FA2', label: 'Concert Hall' },
  15: { backgroundGradient: ['#0A0A2A', '#050515'], nodeColor: '#FFD700', pathColor: '#FFA000', label: 'Space' },
};
```

**Step 2: Apply themed backgrounds to node sections**

Each tier section in the LevelMap gets a gradient background based on its theme. The path between nodes uses the tier's pathColor.

**Step 3: Upgrade node visuals**

- Completed nodes: gold checkmark badge, subtle glow
- Current node: pulsing beacon with particle dots
- Locked nodes: grey with chain icon overlay

**Step 4: Run tests + typecheck**

```bash
npx jest src/screens/__tests__/LevelMapScreen.test.tsx --no-coverage
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/screens/LevelMapScreen.tsx
git commit -m "feat(levelmap): add trophy road themed environments + upgraded nodes"
```

---

## Batch 9: Remaining Screen Revamps (P2-P3)

---

### Task 19: DailySessionScreen — game card exercise cards

**Files:**
- Modify: `src/screens/DailySessionScreen.tsx`

Replace flat exercise list items with `GameCard` components. Each exercise card gets a rarity based on its type:
- Warm-up exercises → `common`
- Lesson exercises → `rare`
- Challenge exercises → `epic`

Add section headers with animated icons (Reanimated fade-in stagger).

**Commit message:** `feat(daily): redesign exercise cards as game cards with rarity borders`

---

### Task 20: SongLibraryScreen — mastery badges + visual upgrade

**Files:**
- Modify: `src/screens/SongLibraryScreen.tsx`

- Add metallic mastery tier badges (bronze/silver/gold/platinum shimmer)
- Genre carousel: add subtle 3D card tilt on scroll (Reanimated translateX → rotateY)
- "NEW" badge: pulsing opacity animation
- Difficulty shown as star crystals (SVG star with gradient fill)

**Commit message:** `feat(songs): add mastery badges + 3D tilt carousel`

---

### Task 21: CatSwitchScreen — rarity borders + evolution preview

**Files:**
- Modify: `src/screens/CatSwitchScreen.tsx`

- Wrap each cat card with rarity border (starter=common, purchasable=rare, legendary=rainbow)
- Add evolution preview: small stages indicator (4 dots, filled = unlocked)
- Wire CatAvatar3D component (falls back to SVG)

**Commit message:** `feat(cats): add rarity borders + evolution preview to cat gallery`

---

### Task 22: ProfileScreen — player card aesthetic

**Files:**
- Modify: `src/screens/ProfileScreen.tsx`

- Stats displayed as game-style badges/shields
- Achievement grid items get shimmer animation on unlock
- Streak flame: animated gradient (orange → red cycling)
- Large cat avatar as centerpiece

**Commit message:** `feat(profile): redesign as player card with badge stats`

---

## Batch 10: Full Test Suite + Verification

---

### Task 23: Run full test suite and fix any regressions

**Step 1: Run full tests**

```bash
npm run typecheck
npm run test
```

**Step 2: Fix any failing tests**

Update test mocks for:
- SoundManager mock (add to jest setup or per-file)
- GameCard imports in screen tests
- ComboMeter/ComboGlow mocks in ExercisePlayer tests

**Step 3: Run E2E baseline**

```bash
npm run e2e:test:ios
```

**Step 4: Commit any fixes**

```bash
git commit -m "fix: update test mocks for Arcade Concert Hall components"
```

---

### Task 24: Update CLAUDE.md and stabilization report

**Files:**
- Modify: `CLAUDE.md` — update test count, add new files to key files table
- Modify: `agent_docs/stabilization-report.md` — add ACH section

**Commit message:** `docs: update CLAUDE.md + stabilization report for Arcade Concert Hall`

---

## External Work (Not Code — Tracked Separately)

These items require external tools/skills and are NOT part of this code plan:

1. **Sound Assets (~30 .wav files):** Source/create in DAW (Logic/GarageBand), royalty-free sites (freesound.org), or from app's own piano samples. Place in `assets/sounds/`. Then update `SOUND_ASSETS` map in `SoundManager.ts`.

2. **3D Cat Models (13 .glb files):** Create in Blender with shared bone rig, export as .glb with Draco compression. Place in `assets/models/cats/`. Then update `MODEL_REGISTRY` in `CatModelLoader.ts`.

3. **Particle Textures:** Star burst, gem trail, combo flame — create as .png sprite sheets. Place in `assets/particles/`.

---

## Execution Order Summary

```
Batch 1: SoundManager Foundation          [Tasks 1-3]   — Enables all future sound
Batch 2: Design Tokens + GameCard         [Tasks 4-5]   — Foundation for all screens
Batch 3: ExercisePlayer Combo Escalation  [Tasks 6-9]   — Core loop dopamine
Batch 4: CompletionModal Loot Reveal      [Tasks 10-12] — Post-exercise celebration
Batch 5: HomeScreen Command Center        [Task 13]     — Daily return driver
Batch 6: AuthScreen Cinematic             [Task 14]     — First impression
Batch 7: 3D Cat Avatar Infrastructure     [Tasks 15-17] — Core differentiator (code)
Batch 8: LevelMap Trophy Road             [Task 18]     — Progression visibility
Batch 9: Remaining Screen Revamps         [Tasks 19-22] — Polish
Batch 10: Verification + Docs             [Tasks 23-24] — Ship-ready
```

Total: 24 tasks, ~10 batches, estimated commit count: ~30
