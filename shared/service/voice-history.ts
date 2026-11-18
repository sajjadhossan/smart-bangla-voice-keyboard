/**
 * In-memory voice history with a hard delete contract.
 *
 * History is a privacy liability: every entry holds final text that was once
 * spoken. Entries are kept only for the lifetime of the process, are never
 * logged, and can be deleted individually or cleared entirely. No persistence
 * to disk and no network — platforms may mirror this surface into their own
 * encrypted store, but the shared contract stays text-free on the wire.
 */
import type { VoiceMode } from '../core/types.ts';

export interface HistoryEntry {
  readonly id: string;
  readonly mode: VoiceMode;
  readonly finalText: string;
  readonly translated: boolean;
  readonly createdAtMs: number;
}

export class VoiceHistory {
  private entries: readonly HistoryEntry[] = [];
  private sequence = 0;

  add(
    mode: VoiceMode,
    finalText: string,
    translated: boolean,
    nowMs: number,
  ): HistoryEntry {
    this.sequence += 1;
    const entry: HistoryEntry = Object.freeze({
      id: `v-${this.sequence}`,
      mode,
      finalText,
      translated,
      createdAtMs: nowMs,
    });
    this.entries = Object.freeze([...this.entries, entry]);
    return entry;
  }

  list(): readonly HistoryEntry[] {
    return this.entries;
  }

  delete(id: string): boolean {
    const before = this.entries.length;
    this.entries = Object.freeze(this.entries.filter((entry) => entry.id !== id));
    return this.entries.length !== before;
  }

  clear(): void {
    this.entries = Object.freeze([]);
  }
}
