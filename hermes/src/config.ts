export type Config = {
  port: number;
  host: string;
  hermesBaseUrl: string;
  hermesApiKey: string;
  hermesModel?: string;
  appToken: string;
  hermesTimeoutMs: number;
  shortMessageMaxChars: number;
  storePath: string;
  pushSender: 'noop';
  ttsBaseUrl?: string;
  ttsApiKey?: string;
  logLevel: string;
};

/** Load a local `.env` when supported by the running Node version. Existing process env wins. */
export function loadEnvironmentFile(): void {
  try { process.loadEnvFile?.('.env'); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function positiveInt(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function url(env: NodeJS.ProcessEnv, name: string, requiredValue = true): string | undefined {
  const value = env[name]?.trim();
  if (!value && !requiredValue) return undefined;
  const actual = value || required(env, name);
  try { new URL(actual); } catch { throw new Error(`${name} must be an absolute URL`); }
  return actual.replace(/\/$/, '');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const pushSender = env.PUSH_SENDER?.trim() || 'noop';
  if (pushSender !== 'noop') throw new Error('PUSH_SENDER must be noop');
  return {
    port: positiveInt(env, 'PORT', 8787),
    host: env.HOST?.trim() || '127.0.0.1',
    hermesBaseUrl: url(env, 'HERMES_BASE_URL')!,
    hermesApiKey: required(env, 'HERMES_API_KEY'),
    hermesModel: env.HERMES_MODEL?.trim() || undefined,
    appToken: required(env, 'HERMES_APP_TOKEN'),
    hermesTimeoutMs: positiveInt(env, 'HERMES_TIMEOUT_MS', 30000),
    shortMessageMaxChars: positiveInt(env, 'SHORT_MESSAGE_MAX_CHARS', 120),
    storePath: env.STORE_PATH?.trim() || './data/store.db',
    pushSender: 'noop',
    ttsBaseUrl: url(env, 'TTS_BASE_URL', false),
    ttsApiKey: env.TTS_API_KEY?.trim() || undefined,
    logLevel: env.LOG_LEVEL?.trim() || 'info',
  };
}
