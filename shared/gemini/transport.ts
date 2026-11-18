/**
 * HTTPS transport boundary. The provider never calls fetch directly, so tests
 * can inject a deterministic transport. Nothing here logs URLs, keys, bodies,
 * audio or returned text.
 */

export interface GeminiRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface TransportResponse {
  readonly status: number;
  readonly body: string;
}

export interface HttpTransport {
  send(request: GeminiRequest, timeoutMs: number): Promise<TransportResponse>;
}

export class NetworkTransportError extends Error {
  constructor(message = 'Network request failed') {
    super(message);
    this.name = 'NetworkTransportError';
  }
}

/** Real HTTPS transport. Timeouts abort the request; no response is logged. */
export class FetchTransport implements HttpTransport {
  async send(request: GeminiRequest, timeoutMs: number): Promise<TransportResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        signal: controller.signal,
      });
      return Object.freeze({ status: response.status, body: await response.text() });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new NetworkTransportError('Request timed out');
      }
      throw new NetworkTransportError();
    } finally {
      clearTimeout(timer);
    }
  }
}
