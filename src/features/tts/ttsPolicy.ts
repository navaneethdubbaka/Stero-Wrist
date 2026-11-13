import type {
  TtsEventOverrideKey,
  TtsProviderId,
} from '../../shared/types/settings';

export type TtsEventKind = TtsEventOverrideKey;

/**
 * Per-event TTS policy map.
 * Whether a notification is spoken is gated by priorityPolicy (Phase 7);
 * this map selects provider id (or silent).
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
  eventProviders?: Partial<Record<TtsEventKind, TtsProviderId | 'silent'>>,
): TtsProviderId | 'silent' {
  const override = eventProviders?.[event];
  if (override !== undefined) return override;
  return settingsProvider;
}

export function shouldSpeak(provider: TtsProviderId | 'silent'): boolean {
  return provider !== 'silent';
}
