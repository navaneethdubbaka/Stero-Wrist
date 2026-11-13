import { useSettingsStore } from '../settings/settingsStore';
import type { SttProvider } from './stt/SttProvider';
import { defaultSttProvider } from './stt/ExpoSpeechSttProvider';
import { useVoiceSessionStore } from './voiceSessionStore';

const MOCK_SEND_MS = 400;
const MOCK_SPEAK_MS = 900;

let timers: ReturnType<typeof setTimeout>[] = [];
let listening = false;

function clearTimers() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

function getDispatch() {
  return useVoiceSessionStore.getState().dispatch;
}

function getSetPartial() {
  return useVoiceSessionStore.getState().setPartial;
}

function runMockPipeline(transcript: string) {
  const dispatch = getDispatch();
  clearTimers();

  timers.push(
    setTimeout(() => {
      dispatch({ type: 'MOCK_SENT' });
      timers.push(
        setTimeout(() => {
          const reply = `Mock Hermes reply to: “${transcript}” (webhook + TTS arrive in Phases 3–4)`;
          dispatch({ type: 'MOCK_REPLY', reply });
          timers.push(
            setTimeout(() => {
              dispatch({ type: 'MOCK_SPEAK_DONE' });
            }, MOCK_SPEAK_MS),
          );
        }, MOCK_SEND_MS),
      );
    }, 200),
  );
}

function softSttError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('no-speech') ||
    lower.includes('no speech') ||
    lower.includes('aborted') ||
    lower.includes('client-error') ||
    lower.includes('speech timeout')
  );
}

export type VoiceControllerDeps = {
  stt?: SttProvider;
};

export async function activateVoiceSession(
  deps: VoiceControllerDeps = {},
): Promise<void> {
  const stt = deps.stt ?? defaultSttProvider;
  const settings = useSettingsStore.getState().settings;
  const dispatch = getDispatch();
  const setPartial = getSetPartial();

  if (!settings.assistant.enabled) {
    dispatch({
      type: 'FAIL',
      message: 'Assistant is disabled in Settings.',
    });
    return;
  }

  if (settings.assistant.defaultMode === 'notification_only') {
    dispatch({
      type: 'FAIL',
      message: 'Notification Only mode — voice input is off.',
    });
    return;
  }

  if (settings.assistant.defaultMode !== 'single_request') {
    dispatch({
      type: 'FAIL',
      message: 'Only Single Request mode is wired in Phase 2.',
    });
    return;
  }

  const current = useVoiceSessionStore.getState().snapshot.state;
  if (current !== 'IDLE' && current !== 'ERROR') {
    return;
  }

  clearTimers();
  dispatch({ type: 'ACTIVATE' });

  const perm = await stt.requestPermissions();
  if (!perm.granted) {
    dispatch({
      type: 'FAIL',
      message: perm.message ?? 'Microphone permission required.',
    });
    return;
  }

  if (!stt.isAvailable()) {
    dispatch({
      type: 'FAIL',
      message:
        'Speech recognition is unavailable on this device. Use a dev client build (not Expo Go).',
    });
    return;
  }

  listening = true;
  try {
    await stt.start(
      {
        language: settings.assistant.language,
        silenceThresholdMs: settings.assistant.silenceThresholdMs,
      },
      {
        onStarted: () => {
          dispatch({ type: 'STT_STARTED' });
        },
        onPartial: (text) => {
          setPartial(text);
        },
        onFinal: (text) => {
          listening = false;
          const trimmed = text.trim();
          if (!trimmed) {
            dispatch({ type: 'TRANSCRIPT_EMPTY' });
            return;
          }
          dispatch({ type: 'TRANSCRIPT_FINAL', transcript: trimmed });
          // Advance through TRANSCRIBING if we only got SPEECH_ENDED path later
          const state = useVoiceSessionStore.getState().snapshot.state;
          if (state === 'SENDING') {
            runMockPipeline(trimmed);
          }
        },
        onEnd: () => {
          if (!listening) return;
          listening = false;
          const partial = useVoiceSessionStore.getState().partialTranscript;
          const state = useVoiceSessionStore.getState().snapshot.state;
          if (state === 'LISTENING' || state === 'TRANSCRIBING') {
            dispatch({ type: 'SPEECH_ENDED' });
            const text =
              useVoiceSessionStore.getState().snapshot.context.finalTranscript ||
              partial;
            if (text.trim()) {
              dispatch({ type: 'TRANSCRIPT_FINAL', transcript: text });
              if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
                runMockPipeline(text.trim());
              }
            } else {
              dispatch({ type: 'TRANSCRIPT_EMPTY' });
            }
          }
        },
        onError: (message) => {
          listening = false;
          if (softSttError(message)) {
            const partial = useVoiceSessionStore.getState().partialTranscript;
            if (partial.trim()) {
              dispatch({ type: 'TRANSCRIPT_FINAL', transcript: partial });
              if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
                runMockPipeline(partial.trim());
              }
              return;
            }
            dispatch({ type: 'TRANSCRIPT_EMPTY' });
            return;
          }
          dispatch({ type: 'FAIL', message });
        },
      },
    );
  } catch (error) {
    listening = false;
    dispatch({
      type: 'FAIL',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to start speech recognition.',
    });
  }
}

export async function cancelVoiceSession(
  deps: VoiceControllerDeps = {},
): Promise<void> {
  const stt = deps.stt ?? defaultSttProvider;
  clearTimers();
  listening = false;
  await stt.abort();
  getDispatch()({ type: 'CANCEL' });
}

export function dismissVoiceError(): void {
  getDispatch()({ type: 'DISMISS_ERROR' });
}
