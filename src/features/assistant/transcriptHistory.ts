import { prefsGetString, prefsSetString } from '../../shared/storage/prefs';

export type TranscriptRecord = {
  id: string;
  text: string;
  reply?: string;
  engine: string;
  createdAt: string;
};

const KEY = 'stero.transcriptHistory.v1';
const MAX = 200;
const listeners = new Set<() => void>();

function readAll(): TranscriptRecord[] {
  const raw = prefsGetString(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TranscriptRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: TranscriptRecord[]): void {
  prefsSetString(KEY, JSON.stringify(rows.slice(0, MAX)));
  for (const fn of listeners) {
    fn();
  }
}

export function subscribeTranscriptHistory(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function listTranscriptHistory(): TranscriptRecord[] {
  return readAll();
}

export function addTranscript(text: string, engine: string): string {
  const trimmed = text.trim();
  const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (!trimmed) return id;
  const row: TranscriptRecord = {
    id,
    text: trimmed,
    engine: engine || 'device',
    createdAt: new Date().toISOString(),
  };
  writeAll([row, ...readAll()]);
  return id;
}

export function setTranscriptReply(id: string, reply: string): void {
  const trimmed = reply.trim();
  if (!id || !trimmed) return;
  writeAll(
    readAll().map((row) => (row.id === id ? { ...row, reply: trimmed } : row)),
  );
}

export function clearTranscriptHistory(): void {
  writeAll([]);
}
