import { synthesizeFishAudioNative } from '../../../modules/stero-assistant/src';
import {
  buildFishTtsRequest,
  resolveFishModelAndVoice,
} from './fishAudioRequest';
import { stopTtsAudioPlayback } from './playTtsAudio';
import type { AudioResult, TtsOptions, TtsProvider } from './TtsProvider';

export class FishAudioTtsProvider implements TtsProvider {
  constructor(
    private apiKey: string | null,
    private extras: { model: string; voiceReferenceId: string },
  ) {}

  async synthesize(text: string, options: TtsOptions): Promise<AudioResult> {
    const apiKey = this.apiKey?.trim() ?? '';
    if (!apiKey) {
      throw new Error('Fish Audio API key is empty. Add it in Text to speech.');
    }
    const { header: model, referenceId } = resolveFishModelAndVoice(
      this.extras.model,
      this.extras.voiceReferenceId,
    );
    if (!referenceId) {
      throw new Error(
        'Fish Audio voice reference ID is empty. Paste the voice model id.',
      );
    }
    const body = buildFishTtsRequest(text, {
      referenceId,
      speed: options.speed,
    });
    console.log(
      `[Stero] Fish TTS model=${model} reference_id=${referenceId} chars=${text.length}`,
    );
    const path = await synthesizeFishAudioNative(
      apiKey,
      model,
      JSON.stringify(body),
    );
    const uri = path.startsWith('file:') ? path : `file://${path}`;
    return { kind: 'file', uri };
  }

  async stop(): Promise<void> {
    await stopTtsAudioPlayback();
  }
}
