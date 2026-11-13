export function createSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `session-${Date.now()}-${rand}`;
}
