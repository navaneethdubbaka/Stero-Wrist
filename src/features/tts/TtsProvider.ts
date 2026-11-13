export type TtsOptions = {
  language: string;
  voice: string;
  speed: number;
};

export type AudioResult = {
  /** How the audio was produced. */
  kind: 'system' | 'file' | 'stream';
  /** Optional local URI when cloud TTS returns a file (Phase 9). */
  uri?: string;
  durationMs?: number;
};

export interface TtsProvider {
  synthesize(text: string, options: TtsOptions): Promise<AudioResult>;
  stop(): Promise<void>;
}

export function ttsOptionsFromSettings(settings: {
  language: string;
  voice: string;
  speed: number;
}): TtsOptions {
  return {
    language: settings.language || 'en-US',
    voice: settings.voice || 'default',
    speed: Number.isFinite(settings.speed) && settings.speed > 0 ? settings.speed : 1,
  };
}

/** Clamp expo-speech rate to a sane range (platform-dependent; keep moderate). */
export function mapSpeedToSpeechRate(speed: number): number {
  const clamped = Math.min(2, Math.max(0.5, speed));
  return clamped;
}
