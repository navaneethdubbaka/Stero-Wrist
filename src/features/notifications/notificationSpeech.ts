import type { VoiceState } from '../assistant/voiceStateMachine';
import { stopScoAndMicService } from '../assistant/audioRoute';
import { useVoiceSessionStore } from '../assistant/voiceSessionStore';
import { useSettingsStore } from '../settings/settingsStore';
import {
  resolveTtsProvider,
  stopActiveTts,
} from '../tts/resolveTtsProvider';
import { ttsOptionsFromSettings } from '../tts/TtsProvider';
import type { TtsEventKind } from '../tts/ttsPolicy';
import { postDeliveryAck } from './deliveryAck';
import { markSpoken as markSpokenInDb } from './inboxRepository';
import {
  clampSpeechVolume,
  compareNotificationPriority,
  shouldSpeakNotification,
} from './priorityPolicy';
import { markSpoken, wasAlreadySpoken } from './spokenDedupe';
import type { HermesNotification } from './types';

const QUEUE_CAP = 3;
const queue: HermesNotification[] = [];
let speaking = false;
let drainSubscribed = false;
let lastVoiceState: VoiceState | null = null;

function ttsEventForPriority(priority: HermesNotification['priority']): TtsEventKind {
  switch (priority) {
    case 'critical':
      return 'notification_critical';
    case 'high':
      return 'notification_high';
    case 'normal':
      return 'notification_normal';
    case 'low':
      return 'notification_low';
  }
}

function voiceState(): VoiceState {
  return useVoiceSessionStore.getState().snapshot.state;
}

function enqueue(note: HermesNotification): void {
  if (queue.some((n) => n.notification_id === note.notification_id)) {
    return;
  }
  queue.push(note);
  queue.sort((a, b) =>
    compareNotificationPriority(a.priority, b.priority),
  );
  while (queue.length > QUEUE_CAP) {
    // Drop oldest non-critical when full.
    const dropIdx = queue.map((n) => n.priority).lastIndexOf('low');
    const idx =
      dropIdx >= 0
        ? dropIdx
        : queue.findIndex((n) => n.priority !== 'critical');
    if (idx >= 0) {
      queue.splice(idx, 1);
    } else {
      queue.shift();
    }
  }
}

/** Exported for smoke tests — mutate a copy of queue pressure logic. */
export function applyQueuePressure(
  items: HermesNotification[],
  incoming: HermesNotification,
  cap = QUEUE_CAP,
): HermesNotification[] {
  const next = items.filter(
    (n) => n.notification_id !== incoming.notification_id,
  );
  next.push(incoming);
  next.sort((a, b) => compareNotificationPriority(a.priority, b.priority));
  while (next.length > cap) {
    const dropIdx = next.map((n) => n.priority).lastIndexOf('low');
    const idx =
      dropIdx >= 0
        ? dropIdx
        : next.findIndex((n) => n.priority !== 'critical');
    if (idx >= 0) {
      next.splice(idx, 1);
    } else {
      next.shift();
    }
  }
  return next;
}

export async function speakNotification(note: HermesNotification): Promise<void> {
  if (wasAlreadySpoken(note.notification_id)) {
    return;
  }

  const settings = useSettingsStore.getState().settings;
  if (!shouldSpeakNotification(note, settings.notifications)) {
    return;
  }

  speaking = true;

  try {
    await stopScoAndMicService();
    const event = ttsEventForPriority(note.priority);
    const resolved = resolveTtsProvider(settings.tts.provider, event);
    if (resolved.silent || !resolved.provider) {
      return;
    }

    markSpoken(note.notification_id);
    try {
      await markSpokenInDb(note.notification_id);
      void postDeliveryAck(note.notification_id, 'spoken');
    } catch {
      // Inbox DB optional for speech path.
    }
    const text = `${note.title}. ${note.message}`;
    const volume = clampSpeechVolume(settings.notifications.speechVolume);
    await resolved.provider.synthesize(
      text,
      ttsOptionsFromSettings({
        ...settings.tts,
        volume,
      }),
    );
  } catch {
    // Non-blocking — notification display already happened.
  } finally {
    speaking = false;
  }
}

/**
 * Session-aware: never cancelVoiceSession.
 * SPEAKING + critical → interrupt TTS and speak now.
 * Busy states → enqueue; IDLE/ERROR → speak now.
 */
export async function enqueueOrSpeak(note: HermesNotification): Promise<void> {
  const settings = useSettingsStore.getState().settings;
  if (!shouldSpeakNotification(note, settings.notifications)) {
    return;
  }
  if (wasAlreadySpoken(note.notification_id)) {
    return;
  }

  const state = voiceState();

  if (state === 'IDLE' || state === 'ERROR') {
    await speakNotification(note);
    return;
  }

  if (state === 'SPEAKING' && note.priority === 'critical') {
    await stopActiveTts();
    await speakNotification(note);
    return;
  }

  // ACTIVATED | LISTENING | TRANSCRIBING | SENDING | WAITING_RESPONSE
  // or SPEAKING + high → queue
  enqueue(note);
}

export async function drainNotificationSpeechQueue(): Promise<void> {
  if (speaking) return;
  const state = voiceState();
  if (state !== 'IDLE' && state !== 'ERROR') return;

  while (queue.length > 0) {
    if (voiceState() !== 'IDLE' && voiceState() !== 'ERROR') break;
    const next = queue.shift();
    if (!next) break;
    await speakNotification(next);
  }
}

export function startVoiceIdleDrainSubscription(): () => void {
  if (drainSubscribed) {
    return () => undefined;
  }
  drainSubscribed = true;
  lastVoiceState = voiceState();

  const unsub = useVoiceSessionStore.subscribe((s) => {
    const next = s.snapshot.state;
    const prev = lastVoiceState;
    lastVoiceState = next;
    if (
      (next === 'IDLE' || next === 'ERROR') &&
      prev !== null &&
      prev !== 'IDLE' &&
      prev !== 'ERROR'
    ) {
      void drainNotificationSpeechQueue();
    }
  });

  return () => {
    drainSubscribed = false;
    unsub();
  };
}

/** Test helpers */
export function peekSpeechQueueLength(): number {
  return queue.length;
}

export function clearSpeechQueue(): void {
  queue.length = 0;
}
