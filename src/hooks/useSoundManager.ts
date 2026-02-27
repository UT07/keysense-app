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
