/**
 * API-key lifecycle: save / replace / remove / masked show. The full key is
 * never returned to UI logs or reports — only a masked form for display.
 * Storage is the platform's encrypted store (Keychain / DPAPI / EncryptedSharedPreferences).
 * Storage failures are converted to err() so Result contracts always hold.
 */
import { err, ok, type Result } from '../core/result.ts';
import { API_KEY_STORAGE_KEY, type SecureStorage } from '../settings/secure-storage.ts';

export interface ApiKeyInfo {
  readonly present: boolean;
  /** e.g. "AIza••••abcd" — safe to display; never the full secret. */
  readonly masked: string;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '\u2022'.repeat(key.length);
  return `${key.slice(0, 4)}${'\u2022'.repeat(Math.min(8, key.length - 8))}${key.slice(-4)}`;
}

/**
 * Offline shape sanity check only. This is NOT validation — the only real
 * validation is a live connection probe (GeminiApiProvider.testConnection).
 */
export function validateApiKeyShape(key: string): string | null {
  const trimmed = key.trim();
  if (trimmed.length === 0) return 'API key is empty';
  if (trimmed.length < 20) return 'API key is too short';
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return 'API key has unexpected characters';
  return null;
}

/** Save or replace — identical operation, both overwrite the stored secret. */
export async function setApiKey(storage: SecureStorage, key: string): Promise<Result<ApiKeyInfo>> {
  const shapeError = validateApiKeyShape(key);
  if (shapeError !== null) return err(shapeError);
  const clean = key.trim();
  try {
    await storage.set(API_KEY_STORAGE_KEY, clean);
  } catch {
    return err('storage_unavailable');
  }
  return ok({ present: true, masked: maskApiKey(clean) });
}

export async function removeApiKey(storage: SecureStorage): Promise<Result<void>> {
  try {
    await storage.remove(API_KEY_STORAGE_KEY);
  } catch {
    return err('storage_unavailable');
  }
  return ok(undefined);
}

export async function getApiKey(storage: SecureStorage): Promise<string | null> {
  return storage.get(API_KEY_STORAGE_KEY);
}

/** Safe for UI display / diagnostics. Never includes the full key. */
export async function getApiKeyInfo(storage: SecureStorage): Promise<Result<ApiKeyInfo>> {
  try {
    const key = await getApiKey(storage);
    return ok(
      key === null
        ? Object.freeze({ present: false, masked: '' })
        : Object.freeze({ present: true, masked: maskApiKey(key) }),
    );
  } catch {
    return err('storage_unavailable');
  }
}
