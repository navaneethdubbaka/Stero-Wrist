import { Platform } from 'react-native';
import {
  isSteroAssistantAvailable,
  preferOutputRoute as nativePreferOutputRoute,
} from '../../../modules/stero-assistant/src';
import type { AudioOutputPreference } from '../../shared/types/settings';

/**
 * Apply preferred playback route after SCO teardown, before TTS.
 * Best-effort: watch speaker only if OS exposes it (no OEM hacks).
 */
export async function applyAudioOutput(
  preference: AudioOutputPreference,
): Promise<void> {
  if (Platform.OS === 'android' && isSteroAssistantAvailable()) {
    try {
      await nativePreferOutputRoute(preference);
      return;
    } catch {
      // fall through to JS no-op
    }
  }
  // iOS / unavailable native: OS default routing after SCO stop.
  void preference;
}
