import * as Speech from 'expo-speech';
import {
  mapSpeedToSpeechRate,
  type AudioResult,
  type TtsOptions,
  type TtsProvider,
} from './TtsProvider';

/**
 * System TTS via expo-speech (Android TextToSpeech / iOS AVSpeechSynthesizer).
 * Speaks on the phone speaker by default.
 */
export class SystemTtsProvider implements TtsProvider {
  private speaking = false;

  async synthesize(text: string, options: TtsOptions): Promise<AudioResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { kind: 'system', durationMs: 0 };
    }

    await this.stop();

    return new Promise<AudioResult>((resolve, reject) => {
      this.speaking = true;
      const speakOptions: Speech.SpeechOptions = {
        language: options.language || 'en-US',
        rate: mapSpeedToSpeechRate(options.speed),
        onDone: () => {
          this.speaking = false;
          resolve({ kind: 'system' });
        },
        onStopped: () => {
          this.speaking = false;
          resolve({ kind: 'system' });
        },
        onError: () => {
          this.speaking = false;
          reject(new Error('System TTS failed to speak.'));
        },
      };

      if (typeof options.volume === 'number' && Number.isFinite(options.volume)) {
        speakOptions.volume = Math.min(1, Math.max(0, options.volume));
      }

      if (options.voice && options.voice !== 'default') {
        speakOptions.voice = options.voice;
      }

      try {
        Speech.speak(trimmed, speakOptions);
      } catch (error) {
        this.speaking = false;
        reject(
          error instanceof Error
            ? error
            : new Error('System TTS failed to start.'),
        );
      }
    });
  }

  async stop(): Promise<void> {
    if (this.speaking || (await Speech.isSpeakingAsync())) {
      Speech.stop();
    }
    this.speaking = false;
  }
}

export const systemTtsProvider = new SystemTtsProvider();
