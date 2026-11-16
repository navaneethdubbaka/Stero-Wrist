export const FISH_TTS_URL = 'https://api.fish.audio/v1/tts';
export const FISH_DEFAULT_MODEL = 's2.1-pro-free';

const FISH_MODEL_HEADERS = new Set([
  's1',
  's2-pro',
  's2.1-pro',
  's2.1-pro-free',
  'drama-3',
]);

/** Header `model` vs body `reference_id` (voice). Accepts voice id in either field. */
export function resolveFishModelAndVoice(
  model: string,
  voiceReferenceId: string,
): { header: string; referenceId: string } {
  const headerOrId = model.trim();
  const voice = voiceReferenceId.trim();
  if (voice) {
    return {
      header: FISH_MODEL_HEADERS.has(headerOrId)
        ? headerOrId
        : FISH_DEFAULT_MODEL,
      referenceId: voice,
    };
  }
  if (FISH_MODEL_HEADERS.has(headerOrId)) {
    return { header: headerOrId, referenceId: '' };
  }
  return {
    header: FISH_DEFAULT_MODEL,
    referenceId: headerOrId,
  };
}

export type FishTtsRequest = {
  text: string;
  reference_id?: string;
  temperature: number;
  top_p: number;
  prosody: {
    speed: number;
    volume: number;
    normalize_loudness: boolean;
  };
  chunk_length: number;
  normalize: boolean;
  format: 'mp3';
  sample_rate: number;
  mp3_bitrate: number;
  latency: 'normal';
  max_new_tokens: number;
  repetition_penalty: number;
  min_chunk_length: number;
  condition_on_previous_chunks: boolean;
  early_stop_threshold: number;
};

/** Matches Fish Audio POST /v1/tts (model is a header, not a body field). */
export function buildFishTtsRequest(
  text: string,
  opts: { referenceId: string; speed: number },
): FishTtsRequest {
  const spoken = text.trim();
  if (!spoken) {
    throw new Error('Fish TTS text is empty.');
  }
  const referenceId = opts.referenceId.trim();
  const speed =
    Number.isFinite(opts.speed) && opts.speed > 0 ? opts.speed : 1;
  const body: FishTtsRequest = {
    text: spoken,
    temperature: 0.7,
    top_p: 0.7,
    prosody: {
      speed,
      volume: 0,
      normalize_loudness: true,
    },
    chunk_length: 300,
    normalize: true,
    format: 'mp3',
    sample_rate: 44100,
    mp3_bitrate: 128,
    latency: 'normal',
    max_new_tokens: 1024,
    repetition_penalty: 1.2,
    min_chunk_length: 50,
    condition_on_previous_chunks: true,
    early_stop_threshold: 1,
  };
  if (referenceId) {
    body.reference_id = referenceId;
  }
  return body;
}
