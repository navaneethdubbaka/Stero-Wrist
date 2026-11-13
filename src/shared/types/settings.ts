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

export type NotificationSettings = {
  fcmEnabled: boolean;
};

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
  "timestamp": "{{timestamp}}"
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
    },
    audio: {
      inputDevice: 'auto',
      outputDevice: 'phone_speaker',
    },
  };
}
