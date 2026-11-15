import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import type { SttCallbacks, SttProvider, SttStartOptions } from './SttProvider';

type NativeSub = { remove: () => void };

/** Confidence floor for treating a partial as commit-worthy after speechend. */
const STRONG_PARTIAL_CONFIDENCE = 0.45;
/** Wait after speechend for a real final before promoting the last partial. */
const SPEECHEND_PROMOTE_MS = 450;

/**
 * Platform STT via expo-speech-recognition (Android SpeechRecognizer / iOS SFSpeechRecognizer).
 * Replaces deprecated @react-native-voice/voice for Expo SDK 58.
 *
 * Android quirk: Google often returns strong partials then empty onResults → expo
 * "nomatch" + cancel() → ERROR_CLIENT. We finalize from the last strong partial
 * on speechend / nomatch / soft end, and ignore teardown noise after that.
 */
export class ExpoSpeechSttProvider implements SttProvider {
  private subs: NativeSub[] = [];
  private latestTranscript = '';
  private finalized = false;
  private promoteTimer: ReturnType<typeof setTimeout> | null = null;

  isAvailable(): boolean {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  }

  async requestPermissions(): Promise<{ granted: boolean; message?: string }> {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        return {
          granted: false,
          message: 'Microphone / speech recognition permission was denied.',
        };
      }
      return { granted: true };
    } catch (error) {
      return {
        granted: false,
        message:
          error instanceof Error
            ? error.message
            : 'Could not request speech permissions.',
      };
    }
  }

  async start(options: SttStartOptions, callbacks: SttCallbacks): Promise<void> {
    this.clearSubs();
    this.latestTranscript = '';
    this.finalized = false;

    const continuous = Boolean(options.continuous);
    const watchSco = Boolean(options.watchSco) && Platform.OS === 'android';
    let persistScoPipe = watchSco;
    let scoPipeRetrying = false;

    const launchRecognizer = () => {
      ExpoSpeechRecognitionModule.start({
        lang: options.language || 'en-US',
        interimResults: true,
        // persist → EXTRA_AUDIO_SOURCE on SCO. Do not force continuous: native
        // continuous never ends, so the watch call stays open after silence.
        continuous,
        recordingOptions: persistScoPipe ? { persist: true } : undefined,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS:
            options.silenceThresholdMs,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: Math.max(
            400,
            Math.floor(options.silenceThresholdMs * 0.6),
          ),
        },
      });
    };

    const clearPromoteTimer = () => {
      if (this.promoteTimer) {
        clearTimeout(this.promoteTimer);
        this.promoteTimer = null;
      }
    };

    const promoteLatestIfNeeded = (): boolean => {
      if (this.finalized) return true;
      const text = this.latestTranscript.trim();
      if (!text) return false;
      // Prefer strong partials; still promote any non-empty last transcript on
      // speechend/nomatch/end — empty Google finals are common after good audio.
      this.finalized = true;
      clearPromoteTimer();
      callbacks.onFinal(text);
      return true;
    };

    const schedulePromoteAfterSpeechEnd = () => {
      if (this.finalized || continuous) return;
      if (!this.latestTranscript.trim()) return;
      clearPromoteTimer();
      this.promoteTimer = setTimeout(() => {
        this.promoteTimer = null;
        promoteLatestIfNeeded();
      }, SPEECHEND_PROMOTE_MS);
    };

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('start', () => {
        scoPipeRetrying = false;
        callbacks.onStarted();
      }),
    );

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: ExpoSpeechRecognitionResultEvent) => {
          const topResult = event.results[0];
          const top = topResult?.transcript?.trim() ?? '';
          const confidence =
            typeof topResult?.confidence === 'number' ? topResult.confidence : 0;

          if (top) {
            this.latestTranscript = top;
          }

          if (event.isFinal) {
            // Device often returns empty finals after good partials ("hello" → []).
            const text = top || this.latestTranscript;
            if (!text) return;
            this.finalized = true;
            clearPromoteTimer();
            callbacks.onFinal(text);
          } else if (top) {
            // High-confidence partials are commit-worthy after speechend.
            if (confidence >= STRONG_PARTIAL_CONFIDENCE || confidence < 0) {
              this.latestTranscript = top;
            }
            callbacks.onPartial(top);
            // If speech already ended (speechend before delayed empty final),
            // keep the promote timer armed with the latest text.
            if (this.promoteTimer) {
              schedulePromoteAfterSpeechEnd();
            }
          }
        },
      ),
    );

    // End-of-utterance: don't wait for empty onResults / nomatch alone.
    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('speechend', () => {
        if (this.latestTranscript.trim()) {
          schedulePromoteAfterSpeechEnd();
        }
      }),
    );

    // Empty Google finals emit nomatch (see ExpoSpeechService.onResults).
    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('nomatch', () => {
        promoteLatestIfNeeded();
      }),
    );

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('end', () => {
        if (scoPipeRetrying) return;
        clearPromoteTimer();
        if (!continuous) {
          promoteLatestIfNeeded();
          callbacks.onEnd();
          this.clearSubs();
          return;
        }
        callbacks.onEnd();
      }),
    );

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener(
        'error',
        (event: ExpoSpeechRecognitionErrorEvent) => {
          const message = event.message || event.error || 'Speech recognition failed.';
          const lower = String(message).toLowerCase();
          // Do not retry without the SCO pipe — that falls back to phone BUILTIN mic.
          if (scoPipeRetrying && (lower.includes('abort') || lower.includes('audio'))) {
            return;
          }
          // cancel() after empty onResults often yields ERROR_CLIENT. If we already
          // have (or just promoted) a transcript, swallow teardown noise.
          if (this.finalized || promoteLatestIfNeeded()) {
            return;
          }
          callbacks.onError(String(message));
          if (!continuous) {
            clearPromoteTimer();
            this.clearSubs();
          }
        },
      ),
    );

    try {
      launchRecognizer();
    } catch (error) {
      clearPromoteTimer();
      this.clearSubs();
      if (continuous) {
        throw new Error(
          'Continuous speech recognition is unavailable on this device. Use Single Request mode.',
        );
      }
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
  }

  async abort(): Promise<void> {
    if (this.promoteTimer) {
      clearTimeout(this.promoteTimer);
      this.promoteTimer = null;
    }
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
    this.clearSubs();
  }

  private clearSubs() {
    if (this.promoteTimer) {
      clearTimeout(this.promoteTimer);
      this.promoteTimer = null;
    }
    for (const sub of this.subs) {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    }
    this.subs = [];
  }
}

export const defaultSttProvider: SttProvider = new ExpoSpeechSttProvider();
