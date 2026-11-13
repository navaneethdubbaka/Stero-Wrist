import type { BackendProfile, AppSettings } from '../../shared/types/settings';
import type { LanternState } from '../../shared/ui/ChannelStrip';
import type { VoiceState } from '../assistant/voiceStateMachine';
import type { NotifyConnectionStatus } from '../notifications/types';

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

export function assistantLanternState(
  settings: AppSettings,
  voiceState: VoiceState,
): LanternState {
  if (!settings.assistant.enabled) return 'off';
  if (settings.assistant.defaultMode === 'notification_only') return 'off';
  if (voiceState === 'ERROR') return 'error';
  if (
    voiceState === 'ACTIVATED' ||
    voiceState === 'LISTENING' ||
    voiceState === 'TRANSCRIBING' ||
    voiceState === 'SENDING' ||
    voiceState === 'WAITING_RESPONSE' ||
    voiceState === 'SPEAKING'
  ) {
    return 'pending';
  }
  return 'ready';
}

export function notifyLanternState(
  fcmEnabled: boolean,
  connection: NotifyConnectionStatus,
): LanternState {
  if (!fcmEnabled || connection === 'off') return 'off';
  if (connection === 'ready') return 'ready';
  if (connection === 'error') return 'error';
  return 'pending';
}

export function buildChannelStates(
  activeProfile: BackendProfile | null,
  settings: AppSettings,
  voiceState: VoiceState = 'IDLE',
  notifyConnection: NotifyConnectionStatus = 'off',
): Record<'assistant' | 'hermes' | 'tts' | 'notify', LanternState> {
  return {
    assistant: assistantLanternState(settings, voiceState),
    hermes: hermesLanternState(activeProfile),
    tts: settings.tts.provider ? 'ready' : 'off',
    notify: notifyLanternState(settings.notifications.fcmEnabled, notifyConnection),
  };
}
