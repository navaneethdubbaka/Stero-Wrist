export type SttStartOptions = {
  language: string;
  /** End-of-utterance silence hint (ms). Honored on Android via RecognizerIntent. */
  silenceThresholdMs: number;
  /** Continuous recognition — emits multiple finals until abort. */
  continuous?: boolean;
  /**
   * Watch HFP SCO is held — stream AudioRecord into the recognizer
   * (EXTRA_AUDIO_SOURCE) instead of Google's builtin mic.
   */
  watchSco?: boolean;
};

export type SttCallbacks = {
  onStarted: () => void;
  onPartial: (transcript: string) => void;
  onFinal: (transcript: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

export interface SttProvider {
  requestPermissions(): Promise<{ granted: boolean; message?: string }>;
  isAvailable(): boolean;
  start(options: SttStartOptions, callbacks: SttCallbacks): Promise<void>;
  stop(): Promise<void>;
  abort(): Promise<void>;
}
