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
import type { SettingsStoreState, AudioSettings, DisplaySettings, NotificationSettings, MidiSettings, OnboardingSettings } from './types';
import { PersistenceManager, STORAGE_KEYS, createDebouncedSave } from './persistence';

/** Data-only shape of settings state (excludes actions) */
type SettingsData = AudioSettings & DisplaySettings & NotificationSettings & MidiSettings & OnboardingSettings;

const defaultSettings: SettingsData = {
  // Audio settings
  masterVolume: 0.8,
  soundEnabled: true,
  hapticEnabled: true,
  metronomeVolume: 0.5,
  keyboardVolume: 0.8,
  audioBufferSize: 4096,

  // Display settings
  showFingerNumbers: true,
  showNoteNames: true,
  preferredHand: 'right' as const,
  darkMode: false,
  showPianoRoll: true,
  showStaffNotation: false,

  // Notification settings
  reminderTime: '09:00',
  reminderEnabled: true,
  dailyGoalMinutes: 10,
  completionNotifications: true,

  // MIDI settings
  lastMidiDeviceId: null,
  lastMidiDeviceName: null,
  autoConnectMidi: true,

  // Onboarding settings
  hasCompletedOnboarding: false,
  experienceLevel: null,
  learningGoal: null,
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

  // Onboarding settings
  setHasCompletedOnboarding: (completed: boolean) => {
    set({ hasCompletedOnboarding: completed });
    debouncedSave({ ...get(), hasCompletedOnboarding: completed });
  },

  setExperienceLevel: (level: 'beginner' | 'intermediate' | 'returning') => {
    set({ experienceLevel: level });
    debouncedSave({ ...get(), experienceLevel: level });
  },

  setLearningGoal: (goal: 'songs' | 'technique' | 'exploration') => {
    set({ learningGoal: goal });
    debouncedSave({ ...get(), learningGoal: goal });
  },

  reset: () => {
    set(defaultSettings);
    PersistenceManager.deleteState(STORAGE_KEYS.SETTINGS);
  },
}));
