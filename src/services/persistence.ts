// src/services/persistence.ts
/**
 * Validated JSON persistence on top of the raw storage areas.
 *
 * Reads come back either as a value that satisfied its guard or as a typed
 * outcome saying why not. The distinction matters: "there is nothing stored"
 * and "what is stored is unreadable" call for different responses, and
 * collapsing them into `null` is how the spent-receipt ledger previously
 * failed open.
 */
import { storage, secureStorage, type KeyValueArea } from './storage';
import { SENSITIVE_KEYS } from '../core/constants';

export type ReadOutcome<T> =
  | { status: 'ok'; value: T }
  | { status: 'empty' }
  | { status: 'corrupt' };

/** Route a key to secure storage if it holds personal data or credentials. */
function areaFor(key: string): KeyValueArea {
  return SENSITIVE_KEYS.includes(key) ? secureStorage : storage;
}

export async function readJson<T>(
  key: string,
  guard: (value: unknown) => value is T
): Promise<ReadOutcome<T>> {
  const raw = await areaFor(key).getItem(key);
  if (raw === null || raw === '') return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'corrupt' };
  }

  return guard(parsed) ? { status: 'ok', value: parsed } : { status: 'corrupt' };
}

/** Rejects if the value could not be written. Callers must not swallow this. */
export async function writeJson(key: string, value: unknown): Promise<void> {
  await areaFor(key).setItem(key, JSON.stringify(value));
}

export async function removeKey(key: string): Promise<void> {
  await areaFor(key).deleteItem(key);
}
