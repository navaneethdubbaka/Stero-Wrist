import { WebhookError } from './errors';

export function getByDotPath(value: unknown, path: string): unknown {
  if (!path.trim()) {
    return undefined;
  }
  const parts = path.split('.').filter(Boolean);
  let current: unknown = value;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function mapWebhookResponse(
  rawBody: string,
  responsePath: string,
  sessionIdPath?: string,
): { responseText: string; sessionId?: string } {
  if (!rawBody.trim()) {
    throw new WebhookError('empty', 'Empty response body from Hermes.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new WebhookError('invalid_json', 'Hermes returned invalid JSON.');
  }

  const mapped = getByDotPath(parsed, responsePath);
  if (typeof mapped !== 'string' || !mapped.trim()) {
    throw new WebhookError(
      'unexpected_format',
      `Response path "${responsePath}" did not yield a non-empty string.`,
    );
  }

  let sessionId: string | undefined;
  if (sessionIdPath) {
    const sid = getByDotPath(parsed, sessionIdPath);
    if (typeof sid === 'string' && sid.trim()) {
      sessionId = sid.trim();
    }
  }

  return { responseText: mapped.trim(), sessionId };
}
