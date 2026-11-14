import Fastify from 'fastify';
import { hasBearerToken } from './auth.ts'; import { loadConfig, loadEnvironmentFile, type Config } from './config.ts'; import { HermesClient, HermesError } from './hermes/client.ts'; import { createPushSender } from './push/index.ts'; import { registerAckRoute } from './routes/ack.ts'; import { registerDevicesRoute } from './routes/devices.ts'; import { registerNotificationsRoute } from './routes/notifications.ts'; import { registerTtsRoute } from './routes/tts.ts'; import { registerVoiceRoute } from './routes/voice.ts'; import { SqliteStore } from './store/db.ts'; import type { Store } from './store/types.ts'; import type { PushSender } from './push/types.ts';
export type AppDeps = { config: Config; store?: Store; hermes?: HermesClient; push?: PushSender };
export function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: { level: deps.config.logLevel }, ajv: { customOptions: { removeAdditional: false } } }); const store = deps.store ?? new SqliteStore(deps.config.storePath); const hermes = deps.hermes ?? new HermesClient(deps.config); const push = deps.push ?? createPushSender(deps.config);
  app.get('/health', async () => ({ ok: true }));
  app.addHook('onRequest', async (request, reply) => { if (request.url === '/health' || request.url === '/notifications' || request.url.startsWith('/notifications/')) return; if (!hasBearerToken(request, deps.config.appToken)) return reply.code(401).send({ error: 'Unauthorized' }); });
  registerVoiceRoute(app, { store, hermes }); registerDevicesRoute(app, store); registerAckRoute(app, store); registerNotificationsRoute(app, { store, hermes, push, maxChars: deps.config.shortMessageMaxChars }); registerTtsRoute(app, deps.config);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HermesError) {
      const status = error.kind === 'rate_limit' ? 429 : error.kind === 'timeout' ? 504 : error.kind === 'network' ? 503 : 502;
      return reply.code(status).send({ error: error.message });
    }
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number' && Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ error: error instanceof Error ? error.message : 'Invalid request' });
    }
    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Invalid request' });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'Internal server error' });
  });
  app.addHook('onClose', async () => store.close()); return app;
}
if (import.meta.main) { loadEnvironmentFile(); const config = loadConfig(); const app = buildApp({ config }); const close = async () => { await app.close(); process.exit(0); }; process.on('SIGINT', close); process.on('SIGTERM', close); await app.listen({ port: config.port, host: config.host }); }
