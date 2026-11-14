import type { BackendProfile } from '../../shared/types/settings';
import { secretGet } from '../../shared/storage/secrets';
import {
  WebhookError,
  classifyHttpStatus,
  isRetryableWebhookError,
} from './errors';
import {
  assertWebhookUrlAllowed,
  buildWebhookBody,
  buildWebhookHeaders,
} from './requestBuilder';
import { mapWebhookResponse } from './responseMapper';

export type SendTranscriptMeta = {
  sessionId: string;
  mode: string;
  allowHttp: boolean;
  context?: Record<string, unknown> | null;
};

export type SendTranscriptResult = {
  responseText: string;
  sessionId?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('Aborted'))
    ) {
      throw new WebhookError('timeout', 'Hermes request timed out.');
    }
    throw new WebhookError(
      'network',
      error instanceof Error ? error.message : 'Network request failed.',
    );
  } finally {
    clearTimeout(timer);
  }
}

async function sendOnce(
  profile: BackendProfile,
  text: string,
  meta: SendTranscriptMeta,
): Promise<SendTranscriptResult> {
  const { webhook } = profile;
  assertWebhookUrlAllowed(webhook.url, meta.allowHttp);

  const token = webhook.tokenSecretId
    ? await secretGet(webhook.tokenSecretId)
    : null;

  let body = buildWebhookBody(webhook, {
    text,
    session_id: meta.sessionId,
    mode: meta.mode,
    timestamp: new Date().toISOString(),
    context: meta.context ?? null,
  });

  // Ensure context is present even for older templates without {{context}}.
  if (
    meta.context &&
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    !('context' in (body as Record<string, unknown>))
  ) {
    body = { ...(body as Record<string, unknown>), context: meta.context };
  }

  const headers = buildWebhookHeaders(webhook, token);

  const response = await fetchWithTimeout(
    webhook.url.trim(),
    {
      method: webhook.method,
      headers,
      body: JSON.stringify(body),
    },
    webhook.timeoutMs || 30000,
  );

  const raw = await response.text();

  if (!response.ok) {
    const code = classifyHttpStatus(response.status);
    throw new WebhookError(
      code,
      `Hermes HTTP ${response.status}`,
      response.status,
    );
  }

  return mapWebhookResponse(
    raw,
    webhook.responseMapping.responsePath,
    webhook.responseMapping.sessionIdPath,
  );
}

export async function sendTranscript(
  profile: BackendProfile | null,
  text: string,
  meta: SendTranscriptMeta,
): Promise<SendTranscriptResult> {
  if (!profile) {
    throw new WebhookError(
      'no_profile',
      'No active Hermes profile selected.',
    );
  }
  if (!profile.webhook.url.trim()) {
    throw new WebhookError('no_profile', 'Active profile has no webhook URL.');
  }

  const maxAttempts = Math.max(1, profile.webhook.retry.maxAttempts || 1);
  const backoffMs = Math.max(0, profile.webhook.retry.backoffMs || 0);

  let lastError: WebhookError | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await sendOnce(profile, text, meta);
    } catch (error) {
      const wh =
        error instanceof WebhookError
          ? error
          : new WebhookError(
              'network',
              error instanceof Error ? error.message : 'Unknown webhook error.',
            );
      lastError = wh;
      const canRetry =
        attempt < maxAttempts && isRetryableWebhookError(wh);
      if (!canRetry) {
        throw wh;
      }
      if (backoffMs > 0) {
        await sleep(backoffMs * attempt);
      }
    }
  }

  throw lastError ?? new WebhookError('network', 'Hermes request failed.');
}
