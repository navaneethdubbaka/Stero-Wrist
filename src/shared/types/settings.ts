export type InteractionMode =
  | 'single_request'
  | 'conversation'
  | 'continuous'
  | 'notification_only';

export type AuthType = 'none' | 'bearer' | 'api_key' | 'header';

export type TtsProviderId =
  | 'system'
  | 'openai'
  | 'fish_audio'
  | 'custom_http';

export type WebhookConfig = {
  url: string;
  method: 'POST' | 'PUT';
  authType: AuthType;
  /** SecureStore key reference; never store raw token here. */
  tokenSecretId?: string;
  headers: Record<string, string>;
  requestTemplate: string;
  responseMapping: {
    responsePath: string;
    sessionIdPath?: string;
  };
  timeoutMs: number;
  retry: {
    maxAttempts: number;
    backoffMs: number;
  };
};

export type BackendProfile = {
  id: string;
  name: string;
  webhook: WebhookConfig;
  ttsProfileId?: string;
};

export type AssistantSettings = {
  enabled: boolean;
  defaultMode: InteractionMode;
  silenceThresholdMs: number;
  language: string;
};

export type TtsSettings = {
  provider: TtsProviderId;
  voice: string;
  language: string;
  speed: number;
  model: string;
  voiceReferenceId: string;
  /** SecureStore key for cloud API key when set. */
  apiKeySecretId?: string;
};

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type PriorityNotifyRule = {
  notify: boolean;
  speak: boolean;
};

export type NotificationSettings = {
  fcmEnabled: boolean;
  /** Full URL for Hermes device-token registration (separate from voice webhook). */
  deviceTokenUrl: string;
  /** Optional delivery ack endpoint (received/displayed/spoken/acked/dismissed). */
  ackUrl: string;
  priorityRules: Record<NotificationPriority, PriorityNotifyRule>;
  quietHoursEnabled: boolean;
  /** Local time HH:mm */
  quietHoursStart: string;
  quietHoursEnd: string;
  criticalDuringQuietHours: boolean;
  /** 0..1 passed to system TTS */
  speechVolume: number;
};

export function createDefaultPriorityRules(): Record<
  NotificationPriority,
  PriorityNotifyRule
> {
  return {
    critical: { notify: true, speak: true },
    high: { notify: true, speak: true },
    normal: { notify: true, speak: false },
    low: { notify: true, speak: false },
  };
}

/** Mic preference — actual route is probed at listen time. */
export type AudioInputPreference = 'auto' | 'watch' | 'phone';

export type AudioOutputPreference = 'phone_speaker';

export type AudioSettings = {
  inputDevice: AudioInputPreference;
  outputDevice: AudioOutputPreference;
};

export type AppSettings = {
  assistant: AssistantSettings;
  tts: TtsSettings;
  notifications: NotificationSettings;
  audio: AudioSettings;
};

export const DEFAULT_REQUEST_TEMPLATE = `{
  "text": "{{text}}",
  "source": "stero-wrist",
  "session_id": "{{session_id}}",
  "mode": "{{mode}}",
  "timestamp": "{{timestamp}}",
  "context": {{context}}
}`;

export function createDefaultWebhook(): WebhookConfig {
  return {
    url: '',
    method: 'POST',
    authType: 'bearer',
    headers: {},
    requestTemplate: DEFAULT_REQUEST_TEMPLATE,
    responseMapping: {
      responsePath: 'response',
      sessionIdPath: 'session_id',
    },
    timeoutMs: 30000,
    retry: {
      maxAttempts: 2,
      backoffMs: 1000,
    },
  };
}

export function createDefaultSettings(): AppSettings {
  return {
    assistant: {
      enabled: true,
      defaultMode: 'single_request',
      silenceThresholdMs: 1200,
      language: 'en-US',
    },
    tts: {
      provider: 'system',
      voice: 'default',
      language: 'en-US',
      speed: 1,
      model: '',
      voiceReferenceId: '',
    },
    notifications: {
      fcmEnabled: false,
      deviceTokenUrl: '',
      ackUrl: '',
      priorityRules: createDefaultPriorityRules(),
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      criticalDuringQuietHours: true,
      speechVolume: 1,
    },
    audio: {
      inputDevice: 'auto',
      outputDevice: 'phone_speaker',
    },
  };
}
