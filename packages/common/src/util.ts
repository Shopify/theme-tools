import { SourceCode, SourceCodeType } from '@shopify/theme-check-common';

export function immutableMapSet<K, V>(
  oldMap: Map<K, V>,
  newKey: K,
  newValue: V,
): Map<K, V> {
  return new Map([...oldMap.entries(), [newKey, newValue]]);
}

export function immutableMapDelete<K, V>(
  oldMap: Map<K, V>,
  removeKey: K,
): Map<K, V> {
  return new Map([...oldMap.entries()].filter(([key, _]) => key !== removeKey));
}

export function assertNever(value: never): never {
  throw new Error(`ERROR! Reached forbidden guard function with unexpected value: ${JSON.stringify(value)}`);
}