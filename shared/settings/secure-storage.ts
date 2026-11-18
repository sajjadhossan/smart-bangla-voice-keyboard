/**
 * Platform must supply a secure implementation:
 * - Android: EncryptedSharedPreferences / Keystore
 * - Windows: DPAPI-protected user store
 * - macOS: Keychain
 * The in-memory version exists for tests only.
 */
export interface SecureStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const API_KEY_STORAGE_KEY = 'gemini_api_key';

export class TestOnlyMemoryStorage implements SecureStorage {
  private readonly data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}
