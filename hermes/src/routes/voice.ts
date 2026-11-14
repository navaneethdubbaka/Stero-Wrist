import type { FastifyInstance } from 'fastify';
import type { HermesClient } from '../hermes/client.ts';
import type { Store } from '../store/types.ts';

type VoiceBody = { text: string; source?: 'stero-wrist'; session_id?: string; mode?: string; timestamp?: string; context?: Record<string, unknown> | null };
export function registerVoiceRoute(app: FastifyInstance, deps: { hermes: HermesClient; store: Store }): void {
  app.post<{ Body: VoiceBody }>('/voice', { schema: { body: { type: 'object', required: ['text'], additionalProperties: false, properties: { text: { type: 'string' }, source: { const: 'stero-wrist' }, session_id: { type: 'string' }, mode: { type: 'string' }, timestamp: { type: 'string' }, context: { anyOf: [{ type: 'object', additionalProperties: true }, { type: 'null' }] } } } } }, async (request, reply) => {
    const body = {
      source: 'stero-wrist' as const,
      session_id: '',
      mode: 'single_request',
      timestamp: new Date().toISOString(),
      context: null as Record<string, unknown> | null,
      ...request.body,
    };
    if (!body.text.trim()) return reply.code(400).send({ error: 'text must not be empty' });
    let content = body.text.trim();
    const id = body.context?.notification_id;
    if (typeof id === 'string') { const notification = deps.store.getNotification(id); if (notification?.detail) content += `\n\nNotification detail: ${notification.detail}`; }
    const response = await deps.hermes.chat(content, body.session_id);
    return { response, session_id: body.session_id };
  });
}
