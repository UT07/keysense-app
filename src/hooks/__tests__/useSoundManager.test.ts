/**
 * Tests for useSoundManagerSync hook + settingsStore UI sound fields
 */

import { useSettingsStore } from '../../stores/settingsStore';
import { PersistenceManager, STORAGE_KEYS } from '../../stores/persistence';

// ---------------------------------------------------------------------------
// settingsStore UI sound settings
// ---------------------------------------------------------------------------

describe('settingsStore UI sound settings', () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
    PersistenceManager.deleteState(STORAGE_KEYS.SETTINGS);
  });

  it('has uiSoundEnabled defaulting to true', () => {
    expect(useSettingsStore.getState().uiSoundEnabled).toBe(true);
  });

  it('has uiSoundVolume defaulting to 0.7', () => {
    expect(useSettingsStore.getState().uiSoundVolume).toBe(0.7);
  });

  it('setUiSoundEnabled updates state', () => {
    useSettingsStore.getState().setUiSoundEnabled(false);
    expect(useSettingsStore.getState().uiSoundEnabled).toBe(false);

    useSettingsStore.getState().setUiSoundEnabled(true);
    expect(useSettingsStore.getState().uiSoundEnabled).toBe(true);
  });

  it('setUiSoundVolume updates state', () => {
    useSettingsStore.getState().setUiSoundVolume(0.3);
    expect(useSettingsStore.getState().uiSoundVolume).toBe(0.3);
  });

  it('setUiSoundVolume clamps to 0-1 range', () => {
    useSettingsStore.getState().setUiSoundVolume(1.5);
    expect(useSettingsStore.getState().uiSoundVolume).toBe(1);

    useSettingsStore.getState().setUiSoundVolume(-0.5);
    expect(useSettingsStore.getState().uiSoundVolume).toBe(0);

    useSettingsStore.getState().setUiSoundVolume(0.5);
    expect(useSettingsStore.getState().uiSoundVolume).toBe(0.5);
  });

  it('reset restores uiSoundEnabled and uiSoundVolume to defaults', () => {
    useSettingsStore.getState().setUiSoundEnabled(false);
    useSettingsStore.getState().setUiSoundVolume(0.2);

    useSettingsStore.getState().reset();

    expect(useSettingsStore.getState().uiSoundEnabled).toBe(true);
    expect(useSettingsStore.getState().uiSoundVolume).toBe(0.7);
  });

  it('updateAudioSettings can batch-update uiSoundEnabled and uiSoundVolume', () => {
    useSettingsStore.getState().updateAudioSettings({
      uiSoundEnabled: false,
      uiSoundVolume: 0.4,
    });

    const state = useSettingsStore.getState();
    expect(state.uiSoundEnabled).toBe(false);
    expect(state.uiSoundVolume).toBe(0.4);
    // Other audio settings unchanged
    expect(state.masterVolume).toBe(0.8);
  });
});
