import type { TtsProviderId } from '../../shared/types/settings';
import { systemTtsProvider } from './SystemTtsProvider';
import type { TtsProvider } from './TtsProvider';
import {
  resolvePolicyProvider,
  shouldSpeak,
  type TtsEventKind,
} from './ttsPolicy';

export type ResolvedTts = {
  provider: TtsProvider | null;
  /** True when a cloud provider was selected but Phase 4 falls back to system. */
  usedSystemFallback: boolean;
  silent: boolean;
};

/**
 * Phase 4: only System TTS is implemented.
 * OpenAI / Fish / Custom fall back to system until Phase 9.
 */
export function resolveTtsProvider(
  settingsProvider: TtsProviderId,
  event: TtsEventKind = 'assistant_response',
): ResolvedTts {
  const policyChoice = resolvePolicyProvider(event, settingsProvider);
  if (!shouldSpeak(policyChoice)) {
    return { provider: null, usedSystemFallback: false, silent: true };
  }

  const wantsCloud =
    settingsProvider === 'openai' ||
    settingsProvider === 'fish_audio' ||
    settingsProvider === 'custom_http';

  return {
    provider: systemTtsProvider,
    usedSystemFallback: wantsCloud,
    silent: false,
  };
}

export async function stopActiveTts(): Promise<void> {
  await systemTtsProvider.stop();
}
