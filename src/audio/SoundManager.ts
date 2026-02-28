import { Audio } from 'expo-av';

import { generateAllSoundUris } from './generateUiSounds';

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
  | 'exercise_complete'
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
  exercise_complete: 'success',
  // Cat
  meow_greeting: 'light',
  purr_happy: 'none',
  meow_sad: 'none',
  meow_celebrate: 'medium',
};

// Sound URIs are generated procedurally at preload time (no .wav files needed)

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

    // Generate all sound URIs procedurally (no .wav files needed)
    const uris = generateAllSoundUris();
    const entries = Object.entries(uris) as [SoundName, string][];

    const results = await Promise.allSettled(
      entries.map(async ([name, uri]) => {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { volume: this.volume, shouldPlay: false },
        );
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
