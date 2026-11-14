/**
 * Optional crash reporting. Off unless EXPO_PUBLIC_SENTRY_DSN is set and
 * `@sentry/react-native` is installed. Scrubs auth headers and PII-ish keys.
 */

type ScrubbedEvent = {
  request?: { headers?: Record<string, unknown> };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  [key: string]: unknown;
};

const SENSITIVE_HEADER = /^(authorization|cookie|x-api-key|x-auth)/i;
const SENSITIVE_KEY =
  /(token|password|secret|authorization|api[_-]?key|device_token)/i;

function scrubRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!value) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[redacted]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = scrubRecord(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function scrubSentryEvent<T extends ScrubbedEvent>(event: T): T | null {
  if (event.request?.headers) {
    const headers: Record<string, unknown> = { ...event.request.headers };
    for (const key of Object.keys(headers)) {
      if (SENSITIVE_HEADER.test(key)) {
        headers[key] = '[redacted]';
      }
    }
    event.request.headers = headers;
  }
  if (event.extra) event.extra = scrubRecord(event.extra);
  if (event.contexts) {
    event.contexts = scrubRecord(event.contexts as Record<string, unknown>);
  }
  return event;
}

export function initObservability(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  try {
    // Optional peer — OSS tree has no DSN and may omit the package.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as {
      init: (opts: {
        dsn: string;
        tracesSampleRate?: number;
        beforeSend?: (event: ScrubbedEvent) => ScrubbedEvent | null;
      }) => void;
    };
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      beforeSend: (event) => scrubSentryEvent(event),
    });
  } catch {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        '[observability] EXPO_PUBLIC_SENTRY_DSN set but @sentry/react-native is not installed.',
      );
    }
  }
}
