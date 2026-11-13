export type SttStartOptions = {
  language: string;
  /** End-of-utterance silence hint (ms). Honored on Android via RecognizerIntent. */
  silenceThresholdMs: number;
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
