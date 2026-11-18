import type { AppSettings } from './schema.ts';
import { DEFAULT_SETTINGS, updateSettings, validateProxyUrl } from './schema.ts';

export type SettingsListener = (settings: AppSettings) => void;

/** Immutable observable settings store. */
export class SettingsStore {
  private current: AppSettings;
  private readonly listeners = new Set<SettingsListener>();

  constructor(initial: AppSettings = DEFAULT_SETTINGS) {
    this.current = Object.freeze({ ...initial });
  }

  get(): AppSettings {
    return this.current;
  }

  patch(change: Partial<AppSettings>): AppSettings {
    if ('proxyUrl' in change) {
      const problem = validateProxyUrl(change.proxyUrl ?? null);
      if (problem !== null) throw new Error(problem);
    }
    const unchanged = Object.entries(change).every(
      ([key, value]) => (this.current as unknown as Record<string, unknown>)[key] === value,
    );
    if (unchanged) return this.current;
    const next = updateSettings(this.current, change);
    if (next === this.current) return this.current;
    this.current = next;
    for (const listener of this.listeners) listener(next);
    return next;
  }

  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
