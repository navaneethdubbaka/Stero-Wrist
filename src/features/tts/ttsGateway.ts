import type { TtsProviderId } from '../../shared/types/settings';
import type { TtsOptions } from './TtsProvider';

export type TtsGatewayRequest = {
  provider: Exclude<TtsProviderId, 'system'>;
  text: string;
  voice: string;
  model: string;
  language: string;
  speed: number;
  voice_reference_id: string;
};

export function buildGatewayRequest(
  provider: Exclude<TtsProviderId, 'system'>,
  text: string,
  options: TtsOptions & { model?: string; voiceReferenceId?: string },
): TtsGatewayRequest {
  return {
    provider,
    text,
    voice: options.voice || 'default',
    model: options.model || '',
    language: options.language || 'en-US',
    speed: options.speed || 1,
    voice_reference_id: options.voiceReferenceId || '',
  };
}

export type GatewayAudioResponse = {
  /** Absolute or relative audio URL */
  url?: string;
  /** Base64-encoded audio (optional gateway shape) */
  audio_base64?: string;
  /** MIME type hint */
  mime?: string;
};

/**
 * POST to TTS gateway. Expects JSON `{ url }` or `{ audio_base64 }` or raw audio body.
 */
export async function fetchGatewayAudio(
  gatewayUrl: string,
  body: TtsGatewayRequest,
  apiKey?: string | null,
): Promise<{ uri: string; kind: 'file' | 'stream' }> {
  const url = gatewayUrl.trim();
  if (!url) {
    throw new Error('TTS gateway URL is empty.');
  }
  if (!url.startsWith('https://')) {
    if (!(__DEV__ && url.startsWith('http://'))) {
      throw new Error(
        'TTS gateway URL must use https:// (http:// only in development).',
      );
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, audio/*',
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`TTS gateway HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await response.json()) as GatewayAudioResponse;
    if (json.url) {
      return { uri: json.url, kind: 'stream' };
    }
    if (json.audio_base64) {
      const mime = json.mime || 'audio/mpeg';
      return {
        uri: `data:${mime};base64,${json.audio_base64}`,
        kind: 'file',
      };
    }
    throw new Error('TTS gateway JSON missing url or audio_base64.');
  }

  // Raw audio bytes — use blob URL on platforms that support it; otherwise fail to system.
  const blob = await response.blob();
  const createObjectUrl = (
    globalThis as { URL?: { createObjectURL?: (b: Blob) => string } }
  ).URL?.createObjectURL;
  if (typeof createObjectUrl === 'function') {
    return { uri: createObjectUrl(blob), kind: 'file' };
  }
  throw new Error('TTS gateway returned raw audio that this runtime cannot play.');
}
