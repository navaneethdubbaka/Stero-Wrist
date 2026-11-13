import { listRecentSpokenIds } from './inboxRepository';

const MAX = 200;
const spokenIds: string[] = [];
const spokenSet = new Set<string>();

export function wasAlreadySpoken(notificationId: string): boolean {
  return spokenSet.has(notificationId);
}

export function markSpoken(notificationId: string): void {
  const id = notificationId.trim();
  if (!id || spokenSet.has(id)) return;
  spokenSet.add(id);
  spokenIds.push(id);
  while (spokenIds.length > MAX) {
    const old = spokenIds.shift();
    if (old) spokenSet.delete(old);
  }
}

export async function hydrateSpokenFromInbox(): Promise<void> {
  try {
    const ids = await listRecentSpokenIds(MAX);
    for (const id of ids) {
      if (!spokenSet.has(id)) {
        spokenSet.add(id);
        spokenIds.push(id);
      }
    }
  } catch {
    // DB may be unavailable in tests / web.
  }
}

/** Test helper */
export function resetSpokenDedupe(): void {
  spokenIds.length = 0;
  spokenSet.clear();
}
