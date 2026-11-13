import type { TtsProviderId } from '../../shared/types/settings';

export type TtsEventKind =
  | 'assistant_response'
  | 'notification_critical'
  | 'notification_high'
  | 'notification_normal'
  | 'notification_low';

/**
 * Per-event TTS policy map.
 * Whether a notification is spoken is gated by priorityPolicy (Phase 7);
 * this map selects provider id (cloud still falls back to system until Phase 9).
 */
export type TtsPolicyMap = Record<TtsEventKind, TtsProviderId | 'silent'>;

export const DEFAULT_TTS_POLICY: TtsPolicyMap = {
  assistant_response: 'system',
  notification_critical: 'system',
  notification_high: 'system',
  notification_normal: 'system',
  notification_low: 'system',
};

export function resolvePolicyProvider(
  event: TtsEventKind,
  settingsProvider: TtsProviderId,
  _policy: TtsPolicyMap = DEFAULT_TTS_POLICY,
): TtsProviderId | 'silent' {
  // Provider selection follows user TTS setting; priority engine gates speak.
  void _policy;
  void event;
  return settingsProvider;
}

export function shouldSpeak(provider: TtsProviderId | 'silent'): boolean {
  return provider !== 'silent';
}
