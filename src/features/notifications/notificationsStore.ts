import { create } from 'zustand';
import type { NotifyConnectionStatus } from './types';

type NotificationsState = {
  status: NotifyConnectionStatus;
  lastRegisteredAt: string | null;
  lastError: string | null;
  setStatus: (
    status: NotifyConnectionStatus,
    patch?: { lastError?: string | null; lastRegisteredAt?: string | null },
  ) => void;
  reset: () => void;
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  status: 'off',
  lastRegisteredAt: null,
  lastError: null,

  setStatus: (status, patch) => {
    const prev = get().lastRegisteredAt;
    let lastRegisteredAt = prev;
    if (patch && 'lastRegisteredAt' in patch) {
      lastRegisteredAt = patch.lastRegisteredAt ?? null;
    } else if (status === 'ready') {
      lastRegisteredAt = new Date().toISOString();
    } else if (status === 'off' || status === 'error') {
      lastRegisteredAt = status === 'off' ? null : prev;
    }

    set({
      status,
      lastError:
        patch && 'lastError' in patch ? (patch.lastError ?? null) : null,
      lastRegisteredAt,
    });
  },

  reset: () => {
    set({ status: 'off', lastRegisteredAt: null, lastError: null });
  },
}));
