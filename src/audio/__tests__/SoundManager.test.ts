import { SoundManager } from '../SoundManager';

// Mock procedural sound generator
jest.mock('../generateUiSounds', () => ({
  generateAllSoundUris: jest.fn(() => ({
    button_press: 'data:audio/wav;base64,AAAA',
    note_correct: 'data:audio/wav;base64,AAAA',
  })),
}));

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
