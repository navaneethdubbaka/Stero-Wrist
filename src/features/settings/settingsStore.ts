import { create } from 'zustand';
import {
  createDefaultPriorityRules,
  createDefaultSettings,
  type AppSettings,
  type AssistantSettings,
  type AudioSettings,
  type NotificationSettings,
  type NotificationPriority,
  type TtsSettings,
} from '../../shared/types/settings';
import { prefsGetString, prefsSetString } from '../../shared/storage/prefs';
import { secretDelete, secretSet, ttsApiKeySecretId } from '../../shared/storage/secrets';
import { normalizeInputPreference } from '../assistant/audioRoutePolicy';
import { clampSpeechVolume } from '../notifications/priorityPolicy';

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
      const settings = createDefaultSettings();
      persist(settings);
      set({ settings, hydrated: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AppSettings;
      const defaults = createDefaultSettings();
      const merged: AppSettings = {
        ...defaults,
        ...parsed,
        assistant: { ...defaults.assistant, ...parsed.assistant },
        tts: { ...defaults.tts, ...parsed.tts },
        notifications: mergeNotificationSettings(
          defaults.notifications,
          parsed.notifications,
        ),
        audio: {
          ...defaults.audio,
          ...parsed.audio,
          inputDevice: normalizeInputPreference(parsed.audio?.inputDevice),
          outputDevice: 'phone_speaker',
        },
      };
      set({
        settings: merged,
        hydrated: true,
      });
    } catch {
      const settings = createDefaultSettings();
      persist(settings);
      set({ settings, hydrated: true });
    }
  },

  setAssistant: (patch) => {
    const settings = {
      ...get().settings,
      assistant: { ...get().settings.assistant, ...patch },
    };
    persist(settings);
    set({ settings });
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

  saveTtsApiKey: async (apiKey) => {
    const id = ttsApiKeySecretId();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      await secretDelete(id).catch(() => undefined);
      get().setTts({ apiKeySecretId: undefined });
      return;
    }
    await secretSet(id, trimmed);
    get().setTts({ apiKeySecretId: id });
  },
}));
