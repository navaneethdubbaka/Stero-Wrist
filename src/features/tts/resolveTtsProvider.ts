import type { TtsProviderId, TtsSettings } from '../../shared/types/settings';
import { secretGet } from '../../shared/storage/secrets';
import { CustomHttpTtsProvider } from './CustomHttpTtsProvider';
import { FishAudioTtsProvider } from './FishAudioTtsProvider';
import { OpenAITtsProvider } from './OpenAITtsProvider';
import { playTtsAudio, stopTtsAudioPlayback } from './playTtsAudio';
import { resolveEffectiveTtsSettings } from './resolveEffectiveTts';
import { systemTtsProvider } from './SystemTtsProvider';
import type { TtsProvider } from './TtsProvider';
import { ttsOptionsFromSettings } from './TtsProvider';
import {
  resolvePolicyProvider,
  shouldSpeak,
  type TtsEventKind,
} from './ttsPolicy';

export type ResolvedTts = {
  provider: TtsProvider | null;
  /** True when cloud was selected but system was used (no gateway / synth fail path). */
  usedSystemFallback: boolean;
  silent: boolean;
  /** Effective TTS settings after profile override. */
  tts: TtsSettings;
};

function isCloudProvider(id: TtsProviderId): boolean {
  return id === 'openai' || id === 'fish_audio' || id === 'custom_http';
}

function createCloudProvider(
  providerId: Exclude<TtsProviderId, 'system'>,
  tts: TtsSettings,
  apiKey: string | null,
): TtsProvider {
  const extras = {
    model: tts.model,
    voiceReferenceId: tts.voiceReferenceId,
  };
  const gateway = tts.gatewayUrl.trim();
  switch (providerId) {
    case 'openai':
      return new OpenAITtsProvider(gateway, apiKey, extras);
    case 'fish_audio':
      return new FishAudioTtsProvider(gateway, apiKey, extras);
    case 'custom_http':
      return new CustomHttpTtsProvider(gateway, apiKey, extras);
  }
}

/**
 * Resolve TTS provider from effective settings (global + active profile override).
 * Cloud requires gatewayUrl; otherwise falls back to system with usedSystemFallback.
 */
export function resolveTtsProvider(
  settingsProvider?: TtsProviderId,
  event: TtsEventKind = 'assistant_response',
  ttsOverride?: TtsSettings,
): ResolvedTts {
  const tts = ttsOverride ?? resolveEffectiveTtsSettings();
  const providerId = settingsProvider ?? tts.provider;
  const policyChoice = resolvePolicyProvider(
    event,
    providerId,
    tts.eventProviders,
  );

  if (!shouldSpeak(policyChoice)) {
    return { provider: null, usedSystemFallback: false, silent: true, tts };
  }

  if (policyChoice === 'system' || policyChoice === 'silent') {
    return {
      provider: systemTtsProvider,
      usedSystemFallback: false,
      silent: false,
      tts,
    };
  }

  if (!isCloudProvider(policyChoice)) {
    return {
      provider: systemTtsProvider,
      usedSystemFallback: false,
      silent: false,
      tts,
    };
  }

  const cloudId: Exclude<TtsProviderId, 'system'> = policyChoice;
  const gateway = tts.gatewayUrl.trim();
  if (!gateway) {
    return {
      provider: systemTtsProvider,
      usedSystemFallback: true,
      silent: false,
      tts,
    };
  }

  const wrapper: TtsProvider = {
    async synthesize(text, options) {
      let apiKey: string | null = null;
      if (tts.apiKeySecretId) {
        try {
          apiKey = await secretGet(tts.apiKeySecretId);
        } catch {
          apiKey = null;
        }
      }
      try {
        const cloud = createCloudProvider(cloudId, tts, apiKey);
        return await cloud.synthesize(text, options);
      } catch {
        return systemTtsProvider.synthesize(text, options);
      }
    },
    async stop() {
      await stopTtsAudioPlayback();
      await systemTtsProvider.stop();
    },
  };

  return {
    provider: wrapper,
    usedSystemFallback: false,
    silent: false,
    tts,
  };
}

/**
 * Synthesize then play file/stream results. System kind is already spoken.
 * On cloud failure mid-flight, retries system once and sets usedSystemFallback.
 */
export async function synthesizeAndPlay(
  text: string,
  event: TtsEventKind = 'assistant_response',
  volume?: number,
): Promise<{ usedSystemFallback: boolean; silent: boolean }> {
  const resolved = resolveTtsProvider(undefined, event);
  if (resolved.silent || !resolved.provider) {
    return { usedSystemFallback: false, silent: true };
  }

  try {
    const result = await resolved.provider.synthesize(
      text,
      ttsOptionsFromSettings({
        ...resolved.tts,
        ...(volume !== undefined ? { volume } : {}),
      }),
    );
    if (result.kind !== 'system') {
      await playTtsAudio(result);
    }
    const fellBackToSystem =
      resolved.usedSystemFallback ||
      (isCloudProvider(resolved.tts.provider) && result.kind === 'system');
    return {
      usedSystemFallback: fellBackToSystem,
      silent: false,
    };
  } catch {
    try {
      await systemTtsProvider.synthesize(
        text,
        ttsOptionsFromSettings({
          ...resolved.tts,
          ...(volume !== undefined ? { volume } : {}),
        }),
      );
      return { usedSystemFallback: true, silent: false };
    } catch {
      return { usedSystemFallback: true, silent: false };
    }
  }
}

export async function stopActiveTts(): Promise<void> {
  await stopTtsAudioPlayback();
  await systemTtsProvider.stop();
}
