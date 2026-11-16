import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { transcribeGroqNative } from '../../../../modules/stero-assistant/src';
import { useSettingsStore } from '../../settings/settingsStore';
import {
  cacheGroqApiKey,
  cachedGroqApiKey,
  groqApiKeySecretId,
  secretGet,
} from '../../../shared/storage/secrets';

const DEVICE_PACKAGES = [
  'com.google.android.tts',
  'com.google.android.as',
  'com.google.android.googlequicksearchbox',
];

function fileUri(path: string): string {
  return path.startsWith('file:') ? path : `file://${path}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recognizeFile(
  uri: string,
  language: string,
  androidRecognitionServicePackage?: string,
): Promise<string> {
  return new Promise((resolve) => {
    let settled = false;
    let latest = '';
    const startedAt = Date.now();
    const subs: Array<{ remove: () => void }> = [];
    const settle = (value: string) => {
      if (settled) return;
      settled = true;
      const text = value.trim() || latest.trim();
      clearTimeout(timer);
      for (const s of subs) {
        try {
          s.remove();
        } catch {
          // ignore
        }
      }
      if (!text) {
        try {
          ExpoSpeechRecognitionModule.abort();
        } catch {
          // ignore
        }
      }
      if (text) {
        console.log(`[Stero] file STT using: ${text}`);
      }
      const wait = text ? 0 : 450;
      setTimeout(() => resolve(text), wait);
    };
    const timer = setTimeout(() => settle(latest), 12_000);
    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const top = event.results[0]?.transcript?.trim() ?? '';
        if (top) {
          latest = top;
          console.log(
            `[Stero] file STT ${event.isFinal ? 'final' : 'partial'}: ${top}`,
          );
        }
        if (event.isFinal) {
          settle(top || latest);
        }
      }),
    );
    subs.push(
      ExpoSpeechRecognitionModule.addListener('error', (event) => {
        console.warn(`[Stero] file STT error: ${event.message ?? event.error}`);
        if (latest) {
          settle(latest);
          return;
        }
        const early = Date.now() - startedAt < 2500;
        const msg = `${event.message ?? ''} ${event.error ?? ''}`.toLowerCase();
        const bindFail =
          msg.includes('not connected') ||
          msg.includes('abort') ||
          msg.includes('client') ||
          msg.includes('busy');
        if (early && bindFail) {
          setTimeout(() => {
            if (!settled && !latest) settle('');
          }, 1600);
          return;
        }
        settle(latest);
      }),
    );
    subs.push(
      ExpoSpeechRecognitionModule.addListener('nomatch', () => {
        settle(latest);
      }),
    );
    try {
      console.log(
        `[Stero] file STT service=${androidRecognitionServicePackage ?? 'default'}`,
      );
      ExpoSpeechRecognitionModule.start({
        lang: language || 'en-US',
        interimResults: true,
        audioSource: {
          uri,
          audioChannels: 1,
          sampleRate: 16000,
        },
        androidRecognitionServicePackage,
      });
    } catch (error) {
      console.warn(
        `[Stero] file STT start failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      settle('');
    }
  });
}

async function transcribeDevice(path: string, language: string): Promise<string> {
  if (Platform.OS !== 'android') return '';
  const uri = fileUri(path);
  try {
    ExpoSpeechRecognitionModule.abort();
  } catch {
    // ignore leftover binder from the previous Talk
  }
  await delay(400);
  for (const pkg of DEVICE_PACKAGES) {
    const text = await recognizeFile(uri, language, pkg);
    if (text) return text;
  }
  return recognizeFile(uri, language, undefined);
}

function groqLanguage(language: string): string {
  const tag = language.trim() || 'en';
  return tag.split(/[-_]/)[0]?.toLowerCase() || 'en';
}

async function loadGroqKey(): Promise<string> {
  const cached = cachedGroqApiKey();
  if (cached) return cached;
  const got = await Promise.race([
    secretGet(groqApiKeySecretId()),
    delay(2500).then(() => null),
  ]);
  const key = got?.trim() ?? '';
  if (!key) {
    throw new Error(
      'Groq API key is empty. Add it in Speech to Text settings.',
    );
  }
  cacheGroqApiKey(key);
  return key;
}

async function transcribeGroq(
  path: string,
  model: 'whisper-large-v3' | 'whisper-large-v3-turbo',
  language: string,
): Promise<string> {
  const apiKey = await loadGroqKey();
  console.log(`[Stero] Groq STT native model=${model}`);
  const text = (
    await transcribeGroqNative(path, apiKey, model, groqLanguage(language))
  ).trim();
  if (!text) {
    throw new Error('Groq STT returned empty text.');
  }
  console.log(`[Stero] file STT using: ${text}`);
  return text;
}

async function transcribeCustom(
  path: string,
  url: string,
  language: string,
): Promise<string> {
  const body = new FormData();
  body.append('audio', {
    uri: fileUri(path),
    type: 'audio/wav',
    name: 'talk.wav',
  } as unknown as Blob);
  body.append('language', language || 'en-US');
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) {
    throw new Error(`Custom STT HTTP ${res.status}`);
  }
  const json = (await res.json()) as { transcript?: string; text?: string };
  return (json.transcript ?? json.text ?? '').trim();
}

export async function transcribeWatchRecording(path: string): Promise<string> {
  const assistant = useSettingsStore.getState().settings.assistant;
  const language = assistant.language || 'en-US';
  const engine = assistant.sttEngine ?? 'device';
  console.log(`[Stero] transcribe hangup recording engine=${engine}`);
  if (engine === 'groq_whisper') {
    return transcribeGroq(path, 'whisper-large-v3', language);
  }
  if (engine === 'groq_whisper_turbo') {
    return transcribeGroq(path, 'whisper-large-v3-turbo', language);
  }
  if (engine === 'custom') {
    const url = assistant.sttUrl?.trim() ?? '';
    if (!url) {
      throw new Error('Custom STT URL is empty. Set it in Assistant settings.');
    }
    return transcribeCustom(path, url, language);
  }
  return transcribeDevice(path, language);
}
