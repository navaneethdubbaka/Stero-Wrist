export type WebhookErrorCode =
  | 'network'
  | 'timeout'
  | 'http_400'
  | 'http_401'
  | 'http_403'
  | 'http_429'
  | 'http_5xx'
  | 'invalid_json'
  | 'empty'
  | 'unexpected_format'
  | 'no_profile'
  | 'insecure_url'
  | 'template_invalid';

export class WebhookError extends Error {
  readonly code: WebhookErrorCode;
  readonly status?: number;

  constructor(code: WebhookErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'WebhookError';
    this.code = code;
    this.status = status;
  }
}

export function isRetryableWebhookError(error: WebhookError): boolean {
  return (
    error.code === 'network' ||
    error.code === 'timeout' ||
    error.code === 'http_429' ||
    error.code === 'http_5xx'
  );
}

export function userMessageForWebhookError(error: WebhookError): string {
  switch (error.code) {
    case 'no_profile':
      return 'No active Hermes profile. Set up Hermes in Profiles first.';
    case 'insecure_url':
      return 'HTTPS is required for webhooks in production builds.';
    case 'http_401':
    case 'http_403':
      return 'Authentication failed — check the token in Profiles.';
    case 'http_429':
      return 'Hermes rate-limited the request. Try again shortly.';
    case 'http_5xx':
      return 'Hermes server error. Try again later.';
    case 'http_400':
      return 'Hermes rejected the request (bad request).';
    case 'timeout':
      return 'Hermes request timed out.';
    case 'network':
      return 'Network unavailable. Check connectivity and retry.';
    case 'invalid_json':
      return 'Hermes returned invalid JSON.';
    case 'empty':
      return 'Hermes returned an empty response.';
    case 'unexpected_format':
      return 'Could not find the response text in Hermes JSON. Check response path mapping.';
    case 'template_invalid':
      return 'Webhook request template is invalid JSON.';
    default:
      return error.message || 'Hermes request failed.';
  }
}

export function classifyHttpStatus(status: number): WebhookErrorCode {
  if (status === 400) return 'http_400';
  if (status === 401) return 'http_401';
  if (status === 403) return 'http_403';
  if (status === 429) return 'http_429';
  if (status >= 500) return 'http_5xx';
  if (status >= 400) return 'http_400';
  return 'http_5xx';
}
