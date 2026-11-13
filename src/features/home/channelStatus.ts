import type { BackendProfile, AppSettings } from '../../shared/types/settings';
import type { LanternState } from '../../shared/ui/ChannelStrip';

export function hermesLanternState(
  activeProfile: BackendProfile | null,
): LanternState {
  if (!activeProfile) return 'off';
  const url = activeProfile.webhook.url.trim();
  if (!url) return 'pending';
  if (url.startsWith('http://')) return 'pending';
  if (url.startsWith('https://')) return 'ready';
  return 'error';
}

export function buildChannelStates(
  activeProfile: BackendProfile | null,
  settings: AppSettings,
): Record<'assistant' | 'hermes' | 'tts' | 'notify', LanternState> {
  return {
    assistant: settings.assistant.enabled ? 'ready' : 'off',
    hermes: hermesLanternState(activeProfile),
    tts: settings.tts.provider ? 'ready' : 'off',
    notify: settings.notifications.fcmEnabled ? 'pending' : 'off',
  };
}
