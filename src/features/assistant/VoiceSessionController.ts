import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from '../settings/settingsStore';
import {
  WebhookError,
  userMessageForWebhookError,
} from '../webhook/errors';
import { sendTranscript } from '../webhook/HermesWebhookClient';
import { createSessionId } from '../webhook/sessionId';
import type { SttProvider } from './stt/SttProvider';
import { defaultSttProvider } from './stt/ExpoSpeechSttProvider';
import { useVoiceSessionStore } from './voiceSessionStore';

const SPEAK_STUB_MS = 900;

let timers: ReturnType<typeof setTimeout>[] = [];
let listening = false;
let pipelineGeneration = 0;

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

async function runWebhookPipeline(transcript: string): Promise<void> {
  const dispatch = getDispatch();
  const generation = ++pipelineGeneration;
  clearTimers();

  const profile = useProfilesStore.getState().getActiveProfile();
  const settings = useSettingsStore.getState().settings;
  let sessionId = useVoiceSessionStore.getState().snapshot.context.sessionId;
  if (!sessionId) {
    sessionId = createSessionId();
  }

  try {
    dispatch({ type: 'REQUEST_SENT' });

    const result = await sendTranscript(profile, transcript, {
      sessionId,
      mode: settings.assistant.defaultMode,
      allowHttp: __DEV__,
    });

    if (generation !== pipelineGeneration) {
      return;
    }

    dispatch({
      type: 'RESPONSE_RECEIVED',
      reply: result.responseText,
      sessionId: result.sessionId ?? sessionId,
    });

    timers.push(
      setTimeout(() => {
        if (generation !== pipelineGeneration) return;
        dispatch({ type: 'SPEAK_DONE' });
      }, SPEAK_STUB_MS),
    );
  } catch (error) {
    if (generation !== pipelineGeneration) {
      return;
    }
    const wh =
      error instanceof WebhookError
        ? error
        : new WebhookError(
            'network',
            error instanceof Error ? error.message : 'Hermes request failed.',
          );
    dispatch({
      type: 'FAIL',
      message: userMessageForWebhookError(wh),
      failedSend: true,
    });
  }
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
      message: 'Only Single Request mode is wired in Phase 2–3.',
    });
    return;
  }

  const current = useVoiceSessionStore.getState().snapshot.state;
  if (current !== 'IDLE' && current !== 'ERROR') {
    return;
  }

  clearTimers();
  pipelineGeneration += 1;
  const sessionId = createSessionId();
  dispatch({ type: 'ACTIVATE', sessionId });

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
          const state = useVoiceSessionStore.getState().snapshot.state;
          if (state === 'SENDING') {
            void runWebhookPipeline(trimmed);
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
                void runWebhookPipeline(text.trim());
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
                void runWebhookPipeline(partial.trim());
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

export async function retryLastTranscript(): Promise<void> {
  const { snapshot } = useVoiceSessionStore.getState();
  if (snapshot.state !== 'ERROR' || !snapshot.context.failedSend) {
    return;
  }
  const transcript = snapshot.context.finalTranscript.trim();
  if (!transcript) {
    return;
  }

  clearTimers();
  getDispatch()({ type: 'RETRY_SEND' });
  if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
    await runWebhookPipeline(transcript);
  }
}

export async function cancelVoiceSession(
  deps: VoiceControllerDeps = {},
): Promise<void> {
  const stt = deps.stt ?? defaultSttProvider;
  clearTimers();
  pipelineGeneration += 1;
  listening = false;
  await stt.abort();
  getDispatch()({ type: 'CANCEL' });
}

export function dismissVoiceError(): void {
  getDispatch()({ type: 'DISMISS_ERROR' });
}
