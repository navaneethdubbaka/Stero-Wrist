import type { FastifyInstance } from 'fastify';
import type { HermesClient } from '../hermes/client.ts';
import { shortenForWatch } from '../hermes/shorten.ts';
import type { PushSender } from '../push/types.ts';
import type { Store } from '../store/types.ts';
type Body = { notification_id: string; title: string; message: string; detail?: string; priority: 'critical' | 'high' | 'normal' | 'low'; speak?: boolean; source?: string; dedupe_key?: string };
export function registerNotificationsRoute(app: FastifyInstance, deps: { store: Store; hermes: HermesClient; push: PushSender; maxChars: number }): void {
  app.post<{ Body: Body }>('/notifications', { schema: { body: { type: 'object', required: ['notification_id','title','message','priority'], additionalProperties: false, properties: { notification_id: { type: 'string', minLength: 1 }, title: { type: 'string', minLength: 1 }, message: { type: 'string', minLength: 1 }, detail: { type: 'string' }, priority: { enum: ['critical','high','normal','low'] }, speak: { type: 'boolean' }, source: { type: 'string' }, dedupe_key: { type: 'string' } } } } }, async request => {
    const body = request.body;
    const short = await shortenForWatch(body.message.trim(), deps.maxChars, deps.hermes);
    const speak = body.speak ?? true;
    const source = body.source ?? 'hermes';
    deps.store.saveNotification({ notification_id: body.notification_id, title: body.title.trim(), message: short.message, detail: body.detail ?? null, priority: body.priority, speak, source, dedupe_key: body.dedupe_key ?? null });
    const payload = { type: 'hermes_notification' as const, notification_id: body.notification_id, title: body.title.trim(), message: short.message, presentation_priority: body.priority, speak, timestamp: new Date().toISOString(), source, ...(body.dedupe_key ? { dedupe_key: body.dedupe_key } : {}) };
    await Promise.all(deps.store.listDevices().map(device => deps.push.send(device, payload)));
    return { ok: true, notification_id: body.notification_id, message_capped: short.capped };
  });
  app.get<{ Params: { id: string } }>('/notifications/:id', async (request, reply) => { const notification = deps.store.getNotification(request.params.id); return notification ? notification : reply.code(404).send({ error: 'notification not found' }); });
}
