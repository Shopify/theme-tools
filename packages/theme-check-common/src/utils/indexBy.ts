/**
 * Returns an Record representation of the collection indexed by keyFn. Assumes
 * the key function returns unique results.
 */
export function indexBy<T, K extends PropertyKey>(
  keyFn: (x: T) => K,
  collection: T[],
): Record<K, T> {
  const record = {} as Record<K, T>;
  for (const item of collection) {
    record[keyFn(item)] = item;
  }
  return record;
}
