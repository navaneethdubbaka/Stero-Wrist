import type { BackendProfile, TtsSettings } from '../../shared/types/settings';
import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from '../settings/settingsStore';

/**
 * Active profile TTS override wins over global settings when present.
 */
export function resolveEffectiveTtsSettings(
  globalTts?: TtsSettings,
  profile?: BackendProfile | null,
): TtsSettings {
  const tts = globalTts ?? useSettingsStore.getState().settings.tts;
  const active =
    profile !== undefined
      ? profile
      : useProfilesStore.getState().getActiveProfile();
  if (!active?.ttsOverride) return tts;
  return { ...tts, ...active.ttsOverride };
}
