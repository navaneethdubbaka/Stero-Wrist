import type { AudioResult, TtsOptions, TtsProvider } from './TtsProvider';
import { buildGatewayRequest, fetchGatewayAudio } from './ttsGateway';
import { stopTtsAudioPlayback } from './playTtsAudio';

export class OpenAITtsProvider implements TtsProvider {
  constructor(
    private gatewayUrl: string,
    private apiKey: string | null,
    private extras: { model: string; voiceReferenceId: string },
  ) {}

  async synthesize(text: string, options: TtsOptions): Promise<AudioResult> {
    const body = buildGatewayRequest('openai', text, {
      ...options,
      model: this.extras.model,
      voiceReferenceId: this.extras.voiceReferenceId,
    });
    const audio = await fetchGatewayAudio(this.gatewayUrl, body, this.apiKey);
    return { kind: audio.kind, uri: audio.uri };
  }

  async stop(): Promise<void> {
    await stopTtsAudioPlayback();
  }
}
