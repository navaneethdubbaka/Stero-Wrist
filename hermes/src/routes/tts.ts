import type { FastifyInstance } from 'fastify'; import type { Config } from '../config.ts';
type Body = { provider: 'openai' | 'fish_audio' | 'custom_http'; text: string; voice: string; model: string; language: string; speed: number; voice_reference_id: string };
export function registerTtsRoute(app: FastifyInstance, config: Pick<Config, 'ttsBaseUrl' | 'ttsApiKey'>): void {
  app.post<{ Body: Body }>('/tts', { schema: { body: { type: 'object', required: ['provider','text','voice','model','language','speed','voice_reference_id'], additionalProperties: false, properties: { provider: { enum: ['openai','fish_audio','custom_http'] }, text: { type: 'string', minLength: 1 }, voice: { type: 'string' }, model: { type: 'string' }, language: { type: 'string' }, speed: { type: 'number' }, voice_reference_id: { type: 'string' } } } } }, async (request, reply) => {
    if (!config.ttsBaseUrl) return reply.code(503).send({ error: 'TTS_BASE_URL is not configured' });
    let upstream: Response;
    try { upstream = await fetch(config.ttsBaseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, audio/*', ...(config.ttsApiKey ? { Authorization: `Bearer ${config.ttsApiKey}` } : {}) }, body: JSON.stringify(request.body) }); } catch { return reply.code(503).send({ error: 'Could not reach TTS upstream' }); }
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const body = Buffer.from(await upstream.arrayBuffer());
    return reply.code(upstream.status).header('content-type', contentType).send(body);
  });
}
