import { create } from 'zustand';
import {
  createDefaultPriorityRules,
  createDefaultSettings,
  normalizeOutputPreference,
  type AppSettings,
  type AssistantSettings,
  type AudioSettings,
  type NotificationSettings,
  type NotificationPriority,
  type SttEngineId,
  type TtsSettings,
} from '../../shared/types/settings';
import { prefsGetString, prefsSetString } from '../../shared/storage/prefs';
import {
  cacheGroqApiKey,
  cacheTtsApiKey,
  groqApiKeySecretId,
  secretDelete,
  secretGet,
  secretSet,
  ttsApiKeySecretId,
} from '../../shared/storage/secrets';
import { normalizeInputPreference } from '../assistant/audioRoutePolicy';
import { clampSpeechVolume } from '../notifications/priorityPolicy';
import { setDialPadCode } from '../../../modules/stero-assistant/src';

const STT_ENGINES: SttEngineId[] = [
  'device',
  'groq_whisper',
  'groq_whisper_turbo',
  'custom',
];

function normalizeSttEngine(value: unknown): SttEngineId {
  if (typeof value === 'string' && STT_ENGINES.includes(value as SttEngineId)) {
    return value as SttEngineId;
  }
  return 'device';
}

function normalizeDialPadCode(value: unknown): string {
  if (typeof value !== 'string') return '010';
  const trimmed = value.trim();
  if (!trimmed) return '010';
  const digits = trimmed.replace(/[^\d]/g, '');
  return digits || '010';
}

function mergeNotificationSettings(
  defaults: NotificationSettings,
  parsed: Partial<NotificationSettings> | undefined,
): NotificationSettings {
  const baseRules = createDefaultPriorityRules();
  const parsedRules = parsed?.priorityRules;
  const priorityRules = { ...baseRules };
  for (const key of Object.keys(baseRules) as NotificationPriority[]) {
    const rule = parsedRules?.[key];
    if (rule) {
      priorityRules[key] = {
        notify: rule.notify ?? baseRules[key].notify,
        speak: rule.speak ?? baseRules[key].speak,
      };
    }
  }

  return {
    ...defaults,
    ...parsed,
    deviceTokenUrl:
      typeof parsed?.deviceTokenUrl === 'string' ? parsed.deviceTokenUrl : '',
    ackUrl: typeof parsed?.ackUrl === 'string' ? parsed.ackUrl : '',
    priorityRules,
    quietHoursEnabled: Boolean(parsed?.quietHoursEnabled ?? defaults.quietHoursEnabled),
    quietHoursStart:
      typeof parsed?.quietHoursStart === 'string' && parsed.quietHoursStart.trim()
        ? parsed.quietHoursStart
        : defaults.quietHoursStart,
    quietHoursEnd:
      typeof parsed?.quietHoursEnd === 'string' && parsed.quietHoursEnd.trim()
        ? parsed.quietHoursEnd
        : defaults.quietHoursEnd,
    criticalDuringQuietHours:
      parsed?.criticalDuringQuietHours ?? defaults.criticalDuringQuietHours,
    speechVolume: clampSpeechVolume(
      typeof parsed?.speechVolume === 'number'
        ? parsed.speechVolume
        : defaults.speechVolume,
    ),
    storeFullNotificationBody:
      parsed?.storeFullNotificationBody ?? defaults.storeFullNotificationBody,
  };
}

const SETTINGS_KEY = 'stero.settings.v1';

type SettingsState = {
  hydrated: boolean;
  settings: AppSettings;
  hydrate: () => void;
  setAssistant: (patch: Partial<AssistantSettings>) => void;
  setTts: (patch: Partial<TtsSettings>) => void;
  setNotifications: (patch: Partial<NotificationSettings>) => void;
  setAudio: (patch: Partial<AudioSettings>) => void;
  saveTtsApiKey: (apiKey: string) => Promise<void>;
  saveGroqApiKey: (apiKey: string) => Promise<void>;
};

function persist(settings: AppSettings) {
  prefsSetString(SETTINGS_KEY, JSON.stringify(settings));
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hydrated: false,
  settings: createDefaultSettings(),

  hydrate: () => {
    const raw = prefsGetString(SETTINGS_KEY);
    if (!raw) {
      // Don't persist defaults — that can wipe Groq STT if prefs were not loaded yet.
      const settings = createDefaultSettings();
      set({ settings, hydrated: true });
      void setDialPadCode(settings.assistant.dialPadCode);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AppSettings;
      const defaults = createDefaultSettings();
      const merged: AppSettings = {
        ...defaults,
        ...parsed,
        assistant: {
          ...defaults.assistant,
          ...parsed.assistant,
          sttEngine: normalizeSttEngine(parsed.assistant?.sttEngine),
          dialPadCode: normalizeDialPadCode(parsed.assistant?.dialPadCode),
        },
        tts: {
          ...defaults.tts,
          ...parsed.tts,
          gatewayUrl:
            typeof parsed.tts?.gatewayUrl === 'string'
              ? parsed.tts.gatewayUrl
              : defaults.tts.gatewayUrl,
          eventProviders: {
            ...(defaults.tts.eventProviders ?? {}),
            ...(parsed.tts?.eventProviders ?? {}),
          },
        },
        notifications: mergeNotificationSettings(
          defaults.notifications,
          parsed.notifications,
        ),
        audio: {
          ...defaults.audio,
          ...parsed.audio,
          inputDevice: normalizeInputPreference(parsed.audio?.inputDevice),
          outputDevice: normalizeOutputPreference(parsed.audio?.outputDevice),
        },
      };
      set({
        settings: merged,
        hydrated: true,
      });
      void setDialPadCode(merged.assistant.dialPadCode);
      const groqId = merged.assistant.groqApiKeySecretId;
      if (groqId) {
        void secretGet(groqId).then((value) => {
          if (value) cacheGroqApiKey(value);
        });
      }
      const ttsKeyId = merged.tts.apiKeySecretId;
      if (ttsKeyId) {
        void secretGet(ttsKeyId).then((value) => {
          if (value) cacheTtsApiKey(value);
        });
      }
    } catch {
      const settings = createDefaultSettings();
      persist(settings);
      set({ settings, hydrated: true });
      void setDialPadCode(settings.assistant.dialPadCode);
    }
  },

  setAssistant: (patch) => {
    const nextAssistant = { ...get().settings.assistant, ...patch };
    if (patch.dialPadCode !== undefined) {
      nextAssistant.dialPadCode = normalizeDialPadCode(patch.dialPadCode);
    }
    const settings = {
      ...get().settings,
      assistant: nextAssistant,
    };
    persist(settings);
    set({ settings });
    if (patch.dialPadCode !== undefined) {
      void setDialPadCode(nextAssistant.dialPadCode);
    }
  },

  setTts: (patch) => {
    const settings = {
      ...get().settings,
      tts: { ...get().settings.tts, ...patch },
    };
    persist(settings);
    set({ settings });
  },

  setNotifications: (patch) => {
    const settings = {
      ...get().settings,
      notifications: { ...get().settings.notifications, ...patch },
    };
    persist(settings);
    set({ settings });
  },

  setAudio: (patch) => {
    const settings = {
      ...get().settings,
      audio: { ...get().settings.audio, ...patch },
    };
    persist(settings);
    set({ settings });
  },

  saveGroqApiKey: async (apiKey) => {
    const id = groqApiKeySecretId();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      cacheGroqApiKey('');
      await secretDelete(id).catch(() => undefined);
      get().setAssistant({ groqApiKeySecretId: undefined });
      return;
    }
    cacheGroqApiKey(trimmed);
    await secretSet(id, trimmed);
    get().setAssistant({ groqApiKeySecretId: id });
  },

  saveTtsApiKey: async (apiKey) => {
    const id = ttsApiKeySecretId();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      cacheTtsApiKey('');
      await secretDelete(id).catch(() => undefined);
      get().setTts({ apiKeySecretId: undefined });
      return;
    }
    cacheTtsApiKey(trimmed);
    await secretSet(id, trimmed);
    get().setTts({ apiKeySecretId: id });
  },
}));
