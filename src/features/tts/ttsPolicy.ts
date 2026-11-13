import type { TtsProviderId } from '../../shared/types/settings';

export type TtsEventKind =
  | 'assistant_response'
  | 'notification_critical'
  | 'notification_high'
  | 'notification_normal'
  | 'notification_low';

/**
 * Per-event TTS policy stubs.
 * Phase 4 only speaks assistant_response; notification keys reserved for Phase 7.
 */
export type TtsPolicyMap = Record<TtsEventKind, TtsProviderId | 'silent'>;

export const DEFAULT_TTS_POLICY: TtsPolicyMap = {
  assistant_response: 'system',
  notification_critical: 'system',
  notification_high: 'system',
  notification_normal: 'silent',
  notification_low: 'silent',
};

export function resolvePolicyProvider(
  event: TtsEventKind,
  settingsProvider: TtsProviderId,
  policy: TtsPolicyMap = DEFAULT_TTS_POLICY,
): TtsProviderId | 'silent' {
  if (event === 'assistant_response') {
    // Assistant replies follow the user's selected provider setting.
    return settingsProvider;
  }
  return policy[event];
}

export function shouldSpeak(provider: TtsProviderId | 'silent'): boolean {
  return provider !== 'silent';
}
