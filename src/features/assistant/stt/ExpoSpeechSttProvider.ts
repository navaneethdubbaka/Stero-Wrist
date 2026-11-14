import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import type { SttCallbacks, SttProvider, SttStartOptions } from './SttProvider';

type NativeSub = { remove: () => void };

/**
 * Platform STT via expo-speech-recognition (Android SpeechRecognizer / iOS SFSpeechRecognizer).
 * Replaces deprecated @react-native-voice/voice for Expo SDK 58.
 */
export class ExpoSpeechSttProvider implements SttProvider {
  private subs: NativeSub[] = [];
  private latestTranscript = '';
  private finalized = false;

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

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('start', () => {
        callbacks.onStarted();
      }),
    );

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: ExpoSpeechRecognitionResultEvent) => {
          const top = event.results[0]?.transcript?.trim() ?? '';
          if (!top) return;
          this.latestTranscript = top;
          if (event.isFinal) {
            this.finalized = true;
            callbacks.onFinal(top);
          } else {
            callbacks.onPartial(top);
          }
        },
      ),
    );

    const continuous = Boolean(options.continuous);

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener('end', () => {
        if (!continuous) {
          if (!this.finalized) {
            callbacks.onFinal(this.latestTranscript);
            this.finalized = true;
          }
          callbacks.onEnd();
          this.clearSubs();
          return;
        }
        // Continuous: platform may restart; only surface end if we stopped.
        callbacks.onEnd();
      }),
    );

    this.subs.push(
      ExpoSpeechRecognitionModule.addListener(
        'error',
        (event: ExpoSpeechRecognitionErrorEvent) => {
          const message = event.message || event.error || 'Speech recognition failed.';
          // User-aborted / no-speech often surfaces as error — treat soft cases upstream.
          callbacks.onError(String(message));
          if (!continuous) {
            this.clearSubs();
          }
        },
      ),
    );

    try {
      ExpoSpeechRecognitionModule.start({
        lang: options.language || 'en-US',
        interimResults: true,
        continuous,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS:
            options.silenceThresholdMs,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: Math.max(
            400,
            Math.floor(options.silenceThresholdMs * 0.6),
          ),
        },
      });
    } catch (error) {
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
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
    this.clearSubs();
  }

  private clearSubs() {
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
