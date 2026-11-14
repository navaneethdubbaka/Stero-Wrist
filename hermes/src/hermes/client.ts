import type { Config } from '../config.ts';

export class HermesError extends Error {
  readonly kind: 'timeout' | 'network' | 'rate_limit' | 'upstream' | 'invalid_response';
  constructor(kind: 'timeout' | 'network' | 'rate_limit' | 'upstream' | 'invalid_response', message: string) { super(message); this.kind = kind; }
}

export class HermesClient {
  private config: Pick<Config, 'hermesBaseUrl' | 'hermesApiKey' | 'hermesModel' | 'hermesTimeoutMs'>;
  constructor(config: Pick<Config, 'hermesBaseUrl' | 'hermesApiKey' | 'hermesModel' | 'hermesTimeoutMs'>) { this.config = config; }
  async chat(content: string, sessionId?: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.hermesTimeoutMs);
    try {
      const body: Record<string, unknown> = { messages: [{ role: 'user', content }] };
      if (this.config.hermesModel) body.model = this.config.hermesModel;
      let response: Response;
      try {
        response = await fetch(`${this.config.hermesBaseUrl}/v1/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${this.config.hermesApiKey}`, 'Content-Type': 'application/json', ...(sessionId ? { 'X-Hermes-Session-Id': sessionId } : {}) }, body: JSON.stringify(body), signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) throw new HermesError('timeout', 'Hermes request timed out');
        throw new HermesError('network', 'Could not reach Hermes');
      }
      if (response.status === 429) throw new HermesError('rate_limit', 'Hermes rate limited the request');
      if (!response.ok) throw new HermesError('upstream', `Hermes returned HTTP ${response.status}`);
      let json: unknown;
      try { json = await response.json(); } catch { throw new HermesError('invalid_response', 'Hermes returned invalid JSON'); }
      const contentValue = (json as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
      if (typeof contentValue !== 'string' || !contentValue.trim()) throw new HermesError('invalid_response', 'Hermes response did not contain text');
      return contentValue.trim();
    } finally { clearTimeout(timer); }
  }
}
