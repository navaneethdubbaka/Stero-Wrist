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
import {
  beginWatchCapture,
  endWatchCapture,
  playListenCue,
  playTranscriptCue,
} from '../../../modules/stero-assistant/src';
import { preferWatchMic, stopScoAndMicService } from './audioRoute';
import { applyAudioOutput } from './audioOutput';
import { dismissOverlay, setOverlayPhase } from './overlayBridge';
import { isOverlayModeSync } from './overlayMode';
import type { SttProvider } from './stt/SttProvider';
import { defaultSttProvider } from './stt/ExpoSpeechSttProvider';
import { useVoiceSessionStore } from './voiceSessionStore';

let timers: ReturnType<typeof setTimeout>[] = [];
let listening = false;
let hangupCommitInFlight = false;
let pipelineGeneration = 0;
/** Conversation turn counter within one activation (same sessionId). */
let conversationTurns = 0;
const CONVERSATION_TURN_CAP = 8;
/** Last activate came from watch Talk / overlay — keep using watch mic on follow-ups. */
let lastWatchTrigger = false;

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

  const output = settings.audio.outputDevice;
  // Watch speaker needs HFP SCO kept up; other outputs tear SCO down first.
  if (output !== 'watch_speaker') {
    await stopScoAndMicService();
  }
  await applyAudioOutput(output);

  try {
    await synthesizeAndPlay(text, 'assistant_response');
  } catch {
    // Keep webhook success visible; finish speaking state without FAIL.
  }

  if (output === 'watch_speaker' && !opts.restoreContinuousMic) {
    await stopScoAndMicService();
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
    // ERROR_CLIENT after cancel() on empty finals ("Other client side errors.")
    lower.includes('client') ||
    lower.includes('speech timeout') ||
    lower.includes('speech-timeout') ||
    lower.includes('busy') ||
    lower.includes('network')
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
  /** When false, tear down listening without closing the Muse orb (re-activate). */
  dismissOverlayUi?: boolean;
  /** Keep warm HFP SCO across cancel/re-activate (watch Talk path). */
  preserveSco?: boolean;
};

async function cueTranscriptIfNeeded(text: string): Promise<void> {
  if (!text.trim()) return;
  try {
    await playTranscriptCue();
  } catch {
    // non-fatal
  }
}

async function hangupWatchCall(): Promise<void> {
  try {
    await endWatchCapture();
  } catch {
    // ignore
  }
}

async function afterTranscript(
  text: string,
  opts: { keepListening?: boolean } = {},
): Promise<void> {
  await cueTranscriptIfNeeded(text);
  if (!opts.keepListening) {
    await hangupWatchCall();
  }
}

async function beginListening(
  stt: SttProvider,
  opts: {
    continuous: boolean;
    reuseSession: boolean;
    watchTrigger?: boolean;
    /** Skip HFP SCO (phone STT retry after no-speech). */
    phoneOnly?: boolean;
  },
): Promise<void> {
  const settings = useSettingsStore.getState().settings;
  const dispatch = getDispatch();
  const setPartial = getSetPartial();
  const setMicRoute = useVoiceSessionStore.getState().setMicRoute;

  const phoneOnly = Boolean(opts.phoneOnly);
  let watchSco = false;

  if (phoneOnly) {
    setMicRoute({
      label: 'Mic: Phone — speak after the beep',
      banner: 'Using phone mic',
    });
  } else if (opts.watchTrigger) {
    const info = await beginWatchCapture();
    watchSco = info.kind === 'watch_hfp' || Boolean(info.scoOn);
    setMicRoute({
      label: watchSco
        ? 'Mic: Watch (HFP) — speak after the beep'
        : 'Mic: Phone — speak after the beep',
      banner: watchSco ? null : 'Using phone mic',
    });
  } else {
    const route = await preferWatchMic(settings.audio.inputDevice);
    watchSco = route.info.kind === 'watch_hfp' && route.info.scoOn;
    setMicRoute({
      label: watchSco
        ? 'Mic: Watch (HFP) — speak after the beep'
        : 'Mic: Phone — speak after the beep',
      banner: route.banner,
    });
  }

  // Ready beep on watch SCO in parallel — do not delay STT / AudioRecord.
  void playListenCue().catch(() => undefined);

  const silenceMs =
    opts.watchTrigger
      ? Math.max(settings.assistant.silenceThresholdMs, 3500)
      : settings.assistant.silenceThresholdMs;

  listening = true;
  const maxListenMs = opts.watchTrigger ? 12_000 : 10_000;
  timers.push(
    setTimeout(() => {
      if (!listening) return;
      void commitOnHangup();
    }, maxListenMs),
  );

  try {
    await stt.start(
      {
        language: settings.assistant.language,
        silenceThresholdMs: silenceMs,
        continuous: opts.continuous,
        watchSco,
      },
      {
        onStarted: () => {
          dispatch({ type: 'STT_STARTED' });
        },
        onPartial: (text) => {
          setPartial(text);
        },
        onFinal: (text) => {
          if (hangupCommitInFlight) return;
          const trimmed =
            text.trim() ||
            useVoiceSessionStore.getState().partialTranscript.trim();
          if (opts.continuous) {
            if (!trimmed) return;
            const state = useVoiceSessionStore.getState().snapshot.state;
            // Drop overlapping segments while a previous turn is in flight.
            if (state !== 'LISTENING') return;
            dispatch({ type: 'TRANSCRIPT_FINAL', transcript: trimmed });
            void afterTranscript(trimmed, { keepListening: true }).then(() => {
              if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
                void runWebhookPipeline(trimmed, { keepListening: true });
              }
            });
            return;
          }

          listening = false;
          if (!trimmed) {
            void stopScoAndMicService();
            dispatch({ type: 'TRANSCRIPT_EMPTY' });
            return;
          }
          dispatch({ type: 'TRANSCRIPT_FINAL', transcript: trimmed });
          void afterTranscript(trimmed).then(() => {
            if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
              void runWebhookPipeline(trimmed);
            }
          });
        },
        onEnd: () => {
          if (hangupCommitInFlight) return;
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
              void afterTranscript(text.trim()).then(() => {
                if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
                  void runWebhookPipeline(text.trim());
                }
              });
            } else {
              void stopScoAndMicService();
              dispatch({ type: 'TRANSCRIPT_EMPTY' });
            }
          }
        },
        onError: (message) => {
          if (hangupCommitInFlight) return;
          if (opts.continuous && softSttError(message)) {
            return;
          }
          // Already finalized / webhook in flight — ignore STT teardown noise
          // (empty onResults → nomatch → cancel → ERROR_CLIENT).
          const stateNow = useVoiceSessionStore.getState().snapshot.state;
          if (
            stateNow === 'SENDING' ||
            stateNow === 'WAITING_RESPONSE' ||
            stateNow === 'SPEAKING'
          ) {
            return;
          }
          listening = false;
          if (softSttError(message)) {
            const partial = useVoiceSessionStore.getState().partialTranscript;
            if (partial.trim()) {
              dispatch({ type: 'TRANSCRIPT_FINAL', transcript: partial });
              void afterTranscript(partial.trim()).then(() => {
                if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
                  void runWebhookPipeline(partial.trim());
                }
              });
              return;
            }
            // Phone-only retry only when watch SCO never came up.
            if (opts.watchTrigger && !opts.phoneOnly && !watchSco) {
              void beginListening(stt, {
                continuous: opts.continuous,
                reuseSession: true,
                watchTrigger: true,
                phoneOnly: true,
              });
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

  await beginListening(stt, {
    continuous: false,
    reuseSession: true,
    watchTrigger: lastWatchTrigger,
  });
}

export async function activateVoiceSession(
  deps: VoiceControllerDeps = {},
): Promise<void> {
  const stt = deps.stt ?? defaultSttProvider;
  const settings = useSettingsStore.getState().settings;
  const dispatch = getDispatch();

  if (!settings.assistant.enabled) {
    console.warn('[Stero] activate skipped: assistant disabled');
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

  const fromWatchUi =
    deps.trigger === 'assistant' || deps.trigger === 'deeplink';
  lastWatchTrigger = fromWatchUi;

  const current = useVoiceSessionStore.getState().snapshot.state;
  if (current !== 'IDLE' && current !== 'ERROR') {
    // Already in a listen/send — do not abort SpeechRecognizer (not-connected).
    if (
      fromWatchUi &&
      (current === 'LISTENING' ||
        current === 'TRANSCRIBING' ||
        current === 'SENDING' ||
        current === 'WAITING_RESPONSE' ||
        current === 'SPEAKING')
    ) {
      return;
    }
    if (fromWatchUi) {
      await cancelVoiceSession({
        ...deps,
        dismissOverlayUi: false,
        preserveSco: true,
      });
    } else {
      return;
    }
  }

  clearTimers();
  pipelineGeneration += 1;
  conversationTurns = 0;
  await stopActiveTts();
  // Watch Talk warms HFP SCO in native before JS runs — don't kill it here.
  if (!fromWatchUi) {
    await stopScoAndMicService();
  }
  const sessionId = createSessionId();
  console.log(
    `[Stero] activate trigger=${deps.trigger ?? 'manual'} continuous=${continuous}`,
  );
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
    watchTrigger: fromWatchUi,
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

function currentHeardText(): string {
  const store = useVoiceSessionStore.getState();
  return (
    store.snapshot.context.finalTranscript.trim() ||
    store.partialTranscript.trim()
  );
}

/** Hang up: send whatever was heard, then close. Empty hangup cancels. */
export async function commitOnHangup(
  deps: VoiceControllerDeps = {},
): Promise<void> {
  if (hangupCommitInFlight) return;
  hangupCommitInFlight = true;
  try {
    await commitOnHangupBody(deps);
  } finally {
    hangupCommitInFlight = false;
  }
}

async function commitOnHangupBody(
  deps: VoiceControllerDeps,
): Promise<void> {
  const stt = deps.stt ?? defaultSttProvider;
  const state = useVoiceSessionStore.getState().snapshot.state;
  if (
    state === 'SENDING' ||
    state === 'WAITING_RESPONSE' ||
    state === 'SPEAKING'
  ) {
    await hangupWatchCall();
    return;
  }

  clearTimers();
  listening = false;
  try {
    await stt.abort();
  } catch {
    // ignore
  }

  const afterAbort = useVoiceSessionStore.getState().snapshot.state;
  if (
    afterAbort === 'SENDING' ||
    afterAbort === 'WAITING_RESPONSE' ||
    afterAbort === 'SPEAKING'
  ) {
    await hangupWatchCall();
    return;
  }

  const text = currentHeardText();
  await hangupWatchCall();
  await stopScoAndMicService();

  if (!text) {
    await cancelVoiceSession({
      ...deps,
      dismissOverlayUi: true,
      preserveSco: true,
    });
    return;
  }

  // Hangup ends the turn — do not auto-listen again (that made Talk appear dead).
  conversationTurns = CONVERSATION_TURN_CAP;
  getDispatch()({ type: 'TRANSCRIPT_FINAL', transcript: text });
  await cueTranscriptIfNeeded(text);
  if (useVoiceSessionStore.getState().snapshot.state === 'SENDING') {
    await runWebhookPipeline(text);
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
  if (!deps.preserveSco) {
    await stopScoAndMicService();
  }
  await stt.abort();
  useVoiceSessionStore.getState().setMicRoute({ label: null, banner: null });
  getDispatch()({ type: 'CANCEL' });
  const shouldDismissOrb = deps.dismissOverlayUi !== false;
  if (shouldDismissOrb && isOverlayModeSync()) {
    void setOverlayPhase('idle');
    void dismissOverlay();
  }
}

export function dismissVoiceError(): void {
  getDispatch()({ type: 'DISMISS_ERROR' });
}
