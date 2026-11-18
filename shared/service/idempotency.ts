/**
 * Idempotency guard for text insertion.
 *
 * Voice capture can be retried (network retry inside the provider, user
 * re-tapping the mic, an app restoring state). Without a guard the same final
 * text would be inserted twice into the focused text field. This class makes
 * "accept once per key" an explicit, testable contract:
 *   - the first successful action result is cached by key;
 *   - concurrent callers with the same key share one in-flight action;
 *   - a failed action is never cached, so a later retry can still succeed;
 *   - `forget`/`clear` are the only ways to release a key (used by history
 *     delete / reset).
 *
 * It is pure in-memory business logic — no platform, no network, no logging of
 * the inserted text.
 */

export interface GuardOutcome<T> {
  readonly value: T;
  /** true when no new action ran (cached or in-flight result was reused). */
  readonly deduplicated: boolean;
}

export class IdempotencyGuard<T> {
  private readonly completed = new Map<string, T>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly cacheWhen: (value: T) => boolean;

  constructor(cacheWhen: (value: T) => boolean = () => true) {
    this.cacheWhen = cacheWhen;
  }

  /** Run `action` at most once per successful key. */
  async run(key: string, action: () => Promise<T>): Promise<GuardOutcome<T>> {
    if (this.completed.has(key)) {
      return { value: this.completed.get(key) as T, deduplicated: true };
    }
    const pending = this.inFlight.get(key);
    if (pending !== undefined) {
      return { value: await pending, deduplicated: true };
    }

    const promise = action();
    this.inFlight.set(key, promise);
    try {
      const value = await promise;
      if (this.cacheWhen(value)) this.completed.set(key, value);
      return { value, deduplicated: false };
    } finally {
      this.inFlight.delete(key);
    }
  }

  has(key: string): boolean {
    return this.completed.has(key);
  }

  forget(key: string): boolean {
    return this.completed.delete(key);
  }

  clear(): void {
    this.completed.clear();
    this.inFlight.clear();
  }
}
