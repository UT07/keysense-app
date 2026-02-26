/**
 * User settings and preferences with MMKV persistence
 *
 * Manages:
 * - Audio configuration (volume, effects, metronome)
 * - Display preferences (theme, notation options)
 * - Notification and reminder settings
 * - MIDI device configuration
 * - User-specific learning preferences
 *
 * All changes are automatically persisted to MMKV
 */

import { create } from 'zustand';
import type { SettingsStoreState, AudioSettings, DisplaySettings, NotificationSettings, MidiSettings, OnboardingSettings, ProfileSettings } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';

/** Data-only shape of settings state (excludes actions) */
type SettingsData = AudioSettings & DisplaySettings & NotificationSettings & MidiSettings & OnboardingSettings & ProfileSettings;

const defaultSettings: SettingsData = {
  // Audio settings
  masterVolume: 0.8,
  soundEnabled: true,
  hapticEnabled: true,
  metronomeVolume: 0.5,
  keyboardVolume: 0.8,
  audioBufferSize: 4096,
  playbackSpeed: 0.5 as const, // Default to 50% speed — comfortable for on-screen keyboard beginners

  // Display settings
  showFingerNumbers: true,
  showNoteNames: true,
  preferredHand: 'right' as const,
  darkMode: false,
  showPianoRoll: true,
  showStaffNotation: false,
  showTutorials: true,

  // Notification settings
  reminderTime: '09:00',
  reminderEnabled: true,
  dailyGoalMinutes: 10,
  completionNotifications: true,

  // MIDI settings
  lastMidiDeviceId: null,
  lastMidiDeviceName: null,
  autoConnectMidi: true,
  preferredInputMethod: 'auto' as const,
  micDetectionMode: 'monophonic' as const,

  // Onboarding settings
  hasCompletedOnboarding: false,
  experienceLevel: null,
  learningGoal: null,

  // Profile settings
  displayName: 'Piano Student',
  avatarEmoji: '\uD83C\uDFB9', // piano emoji
  selectedCatId: 'mini-meowww', // default cat character
};

// Create debounced save function
const debouncedSave = createDebouncedSave(STORAGE_KEYS.SETTINGS, 500);

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  ...defaultSettings,

  // Batch audio settings update
  updateAudioSettings: (settings: Partial<AudioSettings>) => {
    set((state) => ({
      ...state,
      ...settings,
    }));
    debouncedSave(get());
  },

  // Batch display settings update
  updateDisplaySettings: (settings: Partial<DisplaySettings>) => {
    set((state) => ({
      ...state,
      ...settings,
    }));
    debouncedSave(get());
  },

  // Batch notification settings update
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => {
    set((state) => ({
      ...state,
      ...settings,
    }));
    debouncedSave(get());
  },

  // Batch MIDI settings update
  updateMidiSettings: (settings: Partial<MidiSettings>) => {
    set((state) => ({
      ...state,
      ...settings,
    }));
    debouncedSave(get());
  },

  // Individual audio settings
  setMasterVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ masterVolume: clamped });
    debouncedSave({ ...get(), masterVolume: clamped });
  },

  setSoundEnabled: (enabled: boolean) => {
    set({ soundEnabled: enabled });
    debouncedSave(get());
  },

  setHapticEnabled: (enabled: boolean) => {
    set({ hapticEnabled: enabled });
    debouncedSave(get());
  },

  setPlaybackSpeed: (speed: 0.25 | 0.5 | 0.75 | 1.0) => {
    set({ playbackSpeed: speed });
    debouncedSave({ ...get(), playbackSpeed: speed });
  },

  // Individual display settings
  setShowFingerNumbers: (show: boolean) => {
    set({ showFingerNumbers: show });
    debouncedSave(get());
  },

  setShowNoteNames: (show: boolean) => {
    set({ showNoteNames: show });
    debouncedSave(get());
  },

  setPreferredHand: (hand: 'right' | 'left' | 'both') => {
    set({ preferredHand: hand });
    debouncedSave(get());
  },

  setDarkMode: (enabled: boolean) => {
    set({ darkMode: enabled });
    debouncedSave(get());
  },

  setShowTutorials: (show: boolean) => {
    set({ showTutorials: show });
    debouncedSave(get());
  },

  // Individual notification settings
  setReminderTime: (time: string | null) => {
    set({ reminderTime: time });
    debouncedSave(get());
  },

  setDailyGoalMinutes: (minutes: number) => {
    const clamped = Math.max(1, minutes);
    set({ dailyGoalMinutes: clamped });
    debouncedSave({ ...get(), dailyGoalMinutes: clamped });
  },

  // MIDI settings
  setLastMidiDevice: (deviceId: string | null, deviceName: string | null) => {
    set({
      lastMidiDeviceId: deviceId,
      lastMidiDeviceName: deviceName,
    });
    debouncedSave(get());
  },

  setPreferredInputMethod: (method: 'auto' | 'midi' | 'mic' | 'touch') => {
    set({ preferredInputMethod: method });
    debouncedSave({ ...get(), preferredInputMethod: method });
  },

  setMicDetectionMode: (mode: 'monophonic' | 'polyphonic') => {
    set({ micDetectionMode: mode });
    debouncedSave({ ...get(), micDetectionMode: mode });
  },

  // Onboarding settings — saves IMMEDIATELY (not debounced) because
  // this triggers a navigator swap and debounced save can be lost
  setHasCompletedOnboarding: (completed: boolean) => {
    set({ hasCompletedOnboarding: completed });
    PersistenceManager.saveState(STORAGE_KEYS.SETTINGS, { ...get(), hasCompletedOnboarding: completed });
  },

  setExperienceLevel: (level: 'beginner' | 'intermediate' | 'returning') => {
    set({ experienceLevel: level });
    debouncedSave({ ...get(), experienceLevel: level });
  },

  setLearningGoal: (goal: 'songs' | 'technique' | 'exploration') => {
    set({ learningGoal: goal });
    debouncedSave({ ...get(), learningGoal: goal });
  },

  // Profile settings — saves IMMEDIATELY (not debounced) because the user
  // expects the name to persist even if they close the app right after saving
  setDisplayName: (name: string) => {
    const trimmed = name.trim().slice(0, 30).trim();
    if (trimmed.length === 0) return;
    set({ displayName: trimmed });
    PersistenceManager.saveState(STORAGE_KEYS.SETTINGS, { ...get(), displayName: trimmed });
  },

  setAvatarEmoji: (emoji: string) => {
    set({ avatarEmoji: emoji });
    debouncedSave({ ...get(), avatarEmoji: emoji });
  },

  setSelectedCatId: (id: string) => {
    set({ selectedCatId: id });
    debouncedSave({ ...get(), selectedCatId: id });
  },

  reset: () => {
    set(defaultSettings);
    PersistenceManager.deleteState(STORAGE_KEYS.SETTINGS);
  },
}));
