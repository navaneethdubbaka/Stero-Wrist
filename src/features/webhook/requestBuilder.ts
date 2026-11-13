import type { WebhookConfig } from '../../shared/types/settings';
import { WebhookError } from './errors';

export type RequestTemplateVars = {
  text: string;
  session_id: string;
  mode: string;
  timestamp: string;
  /** Embedded as raw JSON (object or null) via {{context}}. */
  context?: Record<string, unknown> | null;
};

export function fillTemplatePlaceholders(
  template: string,
  vars: RequestTemplateVars,
): string {
  const contextJson =
    vars.context === undefined || vars.context === null
      ? 'null'
      : JSON.stringify(vars.context);

  return template
    .replaceAll('{{text}}', jsonEscape(vars.text))
    .replaceAll('{{session_id}}', jsonEscape(vars.session_id))
    .replaceAll('{{mode}}', jsonEscape(vars.mode))
    .replaceAll('{{timestamp}}', jsonEscape(vars.timestamp))
    .replaceAll('{{context}}', contextJson);
}

function jsonEscape(value: string): string {
  // Insert as JSON string content without surrounding quotes when template already quotes.
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function buildWebhookBody(
  webhook: WebhookConfig,
  vars: RequestTemplateVars,
): unknown {
  const filled = fillTemplatePlaceholders(webhook.requestTemplate, {
    ...vars,
    context: vars.context ?? null,
  });
  try {
    return JSON.parse(filled);
  } catch {
    throw new WebhookError(
      'template_invalid',
      'Webhook request template is not valid JSON after placeholder fill.',
    );
  }
}

export function buildWebhookHeaders(
  webhook: WebhookConfig,
  token: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...webhook.headers,
  };

  if (webhook.authType === 'bearer' && token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (webhook.authType === 'api_key' && token) {
    headers['X-Api-Key'] = token;
  }

  return headers;
}

export function assertWebhookUrlAllowed(url: string, allowHttp: boolean): void {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new WebhookError('no_profile', 'Webhook URL is empty.');
  }
  if (trimmed.startsWith('https://')) {
    return;
  }
  if (trimmed.startsWith('http://')) {
    if (allowHttp) {
      return;
    }
    throw new WebhookError(
      'insecure_url',
      'HTTPS is required for webhooks in production.',
    );
  }
  throw new WebhookError(
    'insecure_url',
    'Webhook URL must start with https:// (or http:// in development).',
  );
}
