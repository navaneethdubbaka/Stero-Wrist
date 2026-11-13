import { create } from 'zustand';
import {
  createDefaultWebhook,
  type BackendProfile,
  type WebhookConfig,
} from '../../shared/types/settings';
import { prefsGetString, prefsSetString } from '../../shared/storage/prefs';
import {
  profileTokenSecretId,
  secretDelete,
  secretSet,
} from '../../shared/storage/secrets';

const PROFILES_KEY = 'stero.profiles.v1';
const ACTIVE_KEY = 'stero.profiles.activeId';

type ProfilesState = {
  hydrated: boolean;
  profiles: BackendProfile[];
  activeProfileId: string | null;
  hydrate: () => void;
  createProfile: (name: string) => Promise<BackendProfile>;
  updateProfile: (id: string, patch: Partial<Omit<BackendProfile, 'id'>>) => void;
  updateWebhook: (id: string, webhook: WebhookConfig) => void;
  setActiveProfile: (id: string | null) => void;
  deleteProfile: (id: string) => Promise<void>;
  saveToken: (profileId: string, token: string) => Promise<void>;
  clearToken: (profileId: string) => Promise<void>;
  getActiveProfile: () => BackendProfile | null;
};

function persist(profiles: BackendProfile[], activeProfileId: string | null) {
  prefsSetString(PROFILES_KEY, JSON.stringify(profiles));
  if (activeProfileId) {
    prefsSetString(ACTIVE_KEY, activeProfileId);
  } else {
    prefsSetString(ACTIVE_KEY, '');
  }
}

function newId(): string {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useProfilesStore = create<ProfilesState>((set, get) => ({
  hydrated: false,
  profiles: [],
  activeProfileId: null,

  hydrate: () => {
    const raw = prefsGetString(PROFILES_KEY);
    const active = prefsGetString(ACTIVE_KEY);
    let profiles: BackendProfile[] = [];
    if (raw) {
      try {
        profiles = JSON.parse(raw) as BackendProfile[];
      } catch {
        profiles = [];
      }
    }
    const activeProfileId = active && active.length > 0 ? active : null;
    set({ profiles, activeProfileId, hydrated: true });
  },

  createProfile: async (name: string) => {
    const profile: BackendProfile = {
      id: newId(),
      name: name.trim() || 'Hermes',
      webhook: createDefaultWebhook(),
    };
    const profiles = [...get().profiles, profile];
    const activeProfileId = get().activeProfileId ?? profile.id;
    persist(profiles, activeProfileId);
    set({ profiles, activeProfileId });
    return profile;
  },

  updateProfile: (id, patch) => {
    const profiles = get().profiles.map((p) =>
      p.id === id ? { ...p, ...patch, id: p.id } : p,
    );
    persist(profiles, get().activeProfileId);
    set({ profiles });
  },

  updateWebhook: (id, webhook) => {
    const profiles = get().profiles.map((p) =>
      p.id === id ? { ...p, webhook } : p,
    );
    persist(profiles, get().activeProfileId);
    set({ profiles });
  },

  setActiveProfile: (id) => {
    persist(get().profiles, id);
    set({ activeProfileId: id });
  },

  deleteProfile: async (id) => {
    await secretDelete(profileTokenSecretId(id)).catch(() => undefined);
    const profiles = get().profiles.filter((p) => p.id !== id);
    let activeProfileId = get().activeProfileId;
    if (activeProfileId === id) {
      activeProfileId = profiles[0]?.id ?? null;
    }
    persist(profiles, activeProfileId);
    set({ profiles, activeProfileId });
  },

  saveToken: async (profileId, token) => {
    const secretId = profileTokenSecretId(profileId);
    const trimmed = token.trim();
    if (!trimmed) {
      await secretDelete(secretId).catch(() => undefined);
      const profiles = get().profiles.map((p) => {
        if (p.id !== profileId) return p;
        const { tokenSecretId: _removed, ...webhook } = p.webhook;
        return { ...p, webhook };
      });
      persist(profiles, get().activeProfileId);
      set({ profiles });
      return;
    }
    await secretSet(secretId, trimmed);
    const profiles = get().profiles.map((p) =>
      p.id === profileId
        ? { ...p, webhook: { ...p.webhook, tokenSecretId: secretId } }
        : p,
    );
    persist(profiles, get().activeProfileId);
    set({ profiles });
  },

  clearToken: async (profileId) => {
    await get().saveToken(profileId, '');
  },

  getActiveProfile: () => {
    const { profiles, activeProfileId } = get();
    if (!activeProfileId) return null;
    return profiles.find((p) => p.id === activeProfileId) ?? null;
  },
}));
