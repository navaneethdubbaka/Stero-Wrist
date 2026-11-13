const MAX = 50;
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

/** Test helper */
export function resetSpokenDedupe(): void {
  spokenIds.length = 0;
  spokenSet.clear();
}
