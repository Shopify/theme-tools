/*
 * Outcome helpers shared by the parity tests and scripts/rust-parity-diff.ts,
 * so every caller encodes outcomes and reports divergent paths the same way.
 */
import { BACKEND_KEY } from '../backend';
import { canonical } from './canonical';

export interface Outcome {
  threw: boolean;
  value: unknown;
}

/* Calls the entry point with no backend registered, so the TS parser runs. */
export function withoutBackend<T>(fn: () => T): T {
  const registry = globalThis as Record<symbol, unknown>;
  const saved = registry[BACKEND_KEY];
  delete registry[BACKEND_KEY];
  try {
    return fn();
  } finally {
    registry[BACKEND_KEY] = saved;
  }
}

/* Same encoding as scripts/freeze-baseline.ts, so the hashes are comparable. */
export function canonicalOutcome(outcome: Outcome, source: string): string {
  return (outcome.threw ? 'threw:' : 'returned:') + canonical(outcome.value, source);
}

export function describeThrow(error: unknown): string {
  const ctor = (error as { constructor?: { name?: string } })?.constructor?.name ?? typeof error;
  return `${ctor}: ${String((error as { message?: unknown })?.message ?? error)}`;
}

export function firstDivergentPath(a: Outcome, b: Outcome): string {
  if (a.threw !== b.threw) {
    return `$ (${a.threw ? 'threw' : 'returned'} vs ${b.threw ? 'threw' : 'returned'}: ${
      a.threw ? describeThrow(a.value) : describeThrow(b.value)
    })`;
  }
  const found = divergentPath(a.value, b.value, '$') ?? '$ (aliasing or property descriptors)';
  if (!found.startsWith('$ (aliasing')) return found;
  return `${found}; alias path ${firstAliasPath(a.value, b.value) ?? 'none found'}`;
}

/* Walks both values in own key order and returns the first path where they differ. */
function divergentPath(a: unknown, b: unknown, at: string): string | undefined {
  if (Object.is(a, b)) return undefined;
  if (!isObject(a) || !isObject(b)) return `${at} (${preview(a)} vs ${preview(b)})`;
  if (protoName(a) !== protoName(b)) return `${at} (prototype ${protoName(a)} vs ${protoName(b)})`;

  const keysA = observableKeys(a);
  const keysB = observableKeys(b);
  for (let i = 0; i < Math.max(keysA.length, keysB.length); i++) {
    const key = keysA[i];
    if (key !== keysB[i]) {
      return `${at} (own key ${i}: ${String(key)} vs ${String(keysB[i])})`;
    }
    const child = divergentPath(Reflect.get(a, key), Reflect.get(b, key), childPath(at, a, key));
    if (child !== undefined) return child;
  }
  return undefined;
}

/*
 * `divergentPath` finds no path when only aliasing differs. This walks both
 * values in own key order and returns the first path where one side meets an
 * object it has already met and the other does not, or met it first at another
 * path.
 */
function firstAliasPath(a: unknown, b: unknown): string | undefined {
  const seenA = new Map<object, string>();
  const seenB = new Map<object, string>();
  const walk = (x: unknown, y: unknown, at: string): string | undefined => {
    if (typeof x !== 'object' || x === null || typeof y !== 'object' || y === null)
      return undefined;
    const firstX = firstPath(seenA, x, at);
    const firstY = firstPath(seenB, y, at);
    if (firstX !== firstY) return `${at} (first met at ${firstX} vs ${firstY})`;
    if (firstX !== at) return undefined;
    for (const key of Object.keys(x)) {
      const child = Array.isArray(x) ? `${at}[${key}]` : `${at}.${key}`;
      const found = walk(Reflect.get(x, key), Reflect.get(y, key), child);
      if (found !== undefined) return found;
    }
    return undefined;
  };
  return walk(a, b, '$');
}

function firstPath(seen: Map<object, string>, value: object, at: string): string {
  const first = seen.get(value);
  if (first !== undefined) return first;
  seen.set(value, at);
  return at;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function observableKeys(value: object): (string | symbol)[] {
  return Reflect.ownKeys(value).filter((key) => key !== 'stack');
}

function childPath(at: string, parent: object, key: string | symbol): string {
  if (Array.isArray(parent) && typeof key === 'string' && key !== 'length') return `${at}[${key}]`;
  return `${at}.${String(key)}`;
}

function protoName(value: object): string {
  const proto = Object.getPrototypeOf(value);
  if (proto === null) return 'null';
  return String(proto.constructor?.name ?? '<anonymous>');
}

function preview(value: unknown): string {
  const text = typeof value === 'string' ? JSON.stringify(value) : String(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}
