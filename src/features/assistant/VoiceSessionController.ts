import { useProfilesStore } from '../profiles/profilesStore';
import { useSettingsStore } from '../settings/settingsStore';
import {
  synthesizeAndPlay,
  stopActiveTts,
} from '../tts/resolveTtsProvider';
import {
  WebhookError,
  userMessageForWebhookError,
} from '../webhook/errors';
import { sendTranscript } from '../webhook/HermesWebhookClient';
import { createSessionId } from '../webhook/sessionId';
import { preferWatchMic, stopScoAndMicService } from './audioRoute';
import { applyAudioOutput } from './audioOutput';
import type { SttProvider } from './stt/SttProvider';
import { defaultSttProvider } from './stt/ExpoSpeechSttProvider';
import { useVoiceSessionStore } from './voiceSessionStore';

let timers: ReturnType<typeof setTimeout>[] = [];
let listening = false;
let pipelineGeneration = 0;
/** Conversation turn counter within one activation (same sessionId). */
let conversationTurns = 0;
const CONVERSATION_TURN_CAP = 8;

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

async function speakReply(
  text: string,
  generation: number,
  opts: { restoreContinuousMic?: boolean } = {},
): Promise<void> {
  const dispatch = getDispatch();
  const settings = useSettingsStore.getState().settings;

  // Tear down SCO, then apply preferred output before TTS.
  await stopScoAndMicService();
  await applyAudioOutput(settings.audio.outputDevice);

  try {
    await synthesizeAndPlay(text, 'assistant_response');
  } catch {
    // Keep webhook success visible; finish speaking state without FAIL.
  }

  if (opts.restoreContinuousMic) {
    try {
      await preferWatchMic(settings.audio.inputDevice);
    } catch {
      // Continuous STT may continue on phone mic.
    }
  }

  if (generation === pipelineGeneration) {
    dispatch({ type: 'SPEAK_DONE' });
  }
}

async function runWebhookPipeline(
  transcript: string,
  opts: { keepListening?: boolean } = {},
): Promise<void> {
  const dispatch = getDispatch();
  const generation = ++pipelineGeneration;
  clearTimers();
  if (!opts.keepListening) {
    await stopActiveTts();
  }

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

    await speakReply(result.responseText, generation, {
      restoreContinuousMic: Boolean(opts.keepListening),
    });

    if (generation !== pipelineGeneration) {
      return;
    }

    // Continuous: native STT still running — re-enter LISTENING on the same session.
    if (opts.keepListening) {
      const sid =
        useVoiceSessionStore.getState().snapshot.context.sessionId || sessionId;
      dispatch({ type: 'ACTIVATE', sessionId: sid });
      dispatch({ type: 'STT_STARTED' });
      return;
    }

    // Conversation: after SPEAK_DONE, listen again with same sessionId.
    if (settings.assistant.defaultMode === 'conversation') {
      conversationTurns += 1;
      if (conversationTurns < CONVERSATION_TURN_CAP) {
        void continueListening({ stt: defaultSttProvider });
      }
    }
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

export type VoiceActivateTrigger =
  | 'home'
  | 'assistant'
  | 'deeplink'
  | 'unknown';

export type VoiceControllerDeps = {
  stt?: SttProvider;
  trigger?: VoiceActivateTrigger;
};

async function beginListening(
  stt: SttProvider,
  opts: { continuous: boolean; reuseSession: boolean },
): Promise<void> {
  const settings = useSettingsStore.getState().settings;
  const dispatch = getDispatch();
  const setPartial = getSetPartial();
  const setMicRoute = useVoiceSessionStore.getState().setMicRoute;

  const route = await preferWatchMic(settings.audio.inputDevice);
  setMicRoute({
    label:
      route.info.kind === 'watch_hfp'
        ? `Mic: ${route.info.label || 'Watch HFP'}`
        : `Mic: ${route.info.label || 'Phone'}`,
    banner: route.banner,
  });

  listening = true;
  try {
    await stt.start(
      {
        language: settings.assistant.language,
        silenceThresholdMs: settings.assistant.silenceThresholdMs,
        continuous: opts.continuous,
      },
      {
        onStarted: () => {
          dispatch({ type: 'STT_STARTED' });
        },
        onPartial: (text) => {
          setPartial(text);
        },
        onFinal: (text) => {
          const trimmed = text.trim();
          if (opts.continuous) {
            if (!trimmed) return;
            const state = useVoiceSessionStore.getState().snapshot.state;
            // Drop overlapping segments while a previous turn is in flight.
            if (state !== 'LISTENING') return;
            dispatch({ type: 'TRANSCRIPT_FINAL', transcript: trimmed });
            if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
              void runWebhookPipeline(trimmed, { keepListening: true });
            }
            return;
          }

          listening = false;
          if (!trimmed) {
            void stopScoAndMicService();
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
          if (opts.continuous) {
            // Continuous keeps running until Cancel; ignore soft ends.
            return;
          }
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
              void stopScoAndMicService();
              dispatch({ type: 'TRANSCRIPT_EMPTY' });
            }
          }
        },
        onError: (message) => {
          if (opts.continuous && softSttError(message)) {
            return;
          }
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
            void stopScoAndMicService();
            dispatch({ type: 'TRANSCRIPT_EMPTY' });
            return;
          }
          void stopScoAndMicService();
          dispatch({ type: 'FAIL', message });
        },
      },
    );
  } catch (error) {
    listening = false;
    await stopScoAndMicService();
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to start speech recognition.';
    dispatch({
      type: 'FAIL',
      message: opts.continuous
        ? `${message} Try Single Request mode.`
        : message,
    });
  }
  void opts.reuseSession;
}

/** Conversation follow-up listen — same sessionId, new LISTENING. */
async function continueListening(
  deps: VoiceControllerDeps = {},
): Promise<void> {
  const stt = deps.stt ?? defaultSttProvider;
  const settings = useSettingsStore.getState().settings;
  const dispatch = getDispatch();
  if (settings.assistant.defaultMode !== 'conversation') return;

  const state = useVoiceSessionStore.getState().snapshot.state;
  // SPEAK_DONE lands IDLE; only continue from idle success path.
  if (state !== 'IDLE') return;

  const sessionId =
    useVoiceSessionStore.getState().snapshot.context.sessionId ||
    createSessionId();

  clearTimers();
  await stopActiveTts();
  dispatch({ type: 'ACTIVATE', sessionId });

  const perm = await stt.requestPermissions();
  if (!perm.granted) {
    dispatch({
      type: 'FAIL',
      message: perm.message ?? 'Microphone permission required.',
    });
    return;
  }

  await beginListening(stt, { continuous: false, reuseSession: true });
}

export async function activateVoiceSession(
  deps: VoiceControllerDeps = {},
): Promise<void> {
  const stt = deps.stt ?? defaultSttProvider;
  const settings = useSettingsStore.getState().settings;
  const dispatch = getDispatch();

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

  const mode = settings.assistant.defaultMode;
  const continuous = mode === 'continuous';

  const current = useVoiceSessionStore.getState().snapshot.state;
  if (current !== 'IDLE' && current !== 'ERROR') {
    // Re-activate from watch/assistant: cancel then restart.
    if (deps.trigger === 'assistant' || deps.trigger === 'deeplink') {
      await cancelVoiceSession(deps);
    } else {
      return;
    }
  }

  clearTimers();
  pipelineGeneration += 1;
  conversationTurns = 0;
  await stopActiveTts();
  await stopScoAndMicService();
  const sessionId = createSessionId();
  dispatch({ type: 'ACTIVATE', sessionId });
  useVoiceSessionStore.getState().setMicRoute({ label: null, banner: null });

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

  await beginListening(stt, {
    continuous,
    reuseSession: false,
  });
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
  await stopActiveTts();
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
  conversationTurns = CONVERSATION_TURN_CAP;
  await stopActiveTts();
  await stopScoAndMicService();
  await stt.abort();
  useVoiceSessionStore.getState().setMicRoute({ label: null, banner: null });
  getDispatch()({ type: 'CANCEL' });
}

export function dismissVoiceError(): void {
  getDispatch()({ type: 'DISMISS_ERROR' });
}
