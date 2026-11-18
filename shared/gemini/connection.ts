/**
 * Pure connection-state machine. All 8 ConnectionState values are produced
 * from real events (HTTP status / transport outcome / key presence) — never
 * from a key regex or local guess.
 */
import type { ConnectionState } from '../core/types.ts';

export type ConnectionEvent =
  | { readonly type: 'check_started' }
  | { readonly type: 'http_result'; readonly status: number }
  | { readonly type: 'transport_error' }
  | { readonly type: 'key_removed' }
  | { readonly type: 'key_saved' };

/** Map an actual HTTP status to a connection state. */
export function classifyStatus(status: number): ConnectionState {
  if (status >= 200 && status < 300) return 'connected';
  if (status === 400 || status === 401) return 'invalid_api_key';
  if (status === 403) return 'authentication_failed';
  if (status === 429) return 'quota_exceeded';
  if (status === 404 || status === 405 || status === 422) return 'service_unavailable';
  if (status >= 500 && status < 600) return 'service_unavailable';
  // Coarse fallback for any other 4xx: rejected before reaching the model.
  return 'authentication_failed';
}

/** Advance state from an event. 2xx ⇒ connected; network throw ⇒ network_error. */
export function nextConnectionState(
  _current: ConnectionState,
  event: ConnectionEvent,
): ConnectionState {
  switch (event.type) {
    case 'check_started':
      return 'connecting';
    case 'http_result':
      return classifyStatus(event.status);
    case 'transport_error':
      return 'network_error';
    case 'key_removed':
    case 'key_saved':
      return 'not_configured';
  }
}
