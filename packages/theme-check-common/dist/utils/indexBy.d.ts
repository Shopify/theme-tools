/**
 * Returns an Record representation of the collection indexed by keyFn. Assumes
 * the key function returns unique results.
 */
export declare function indexBy<T, K extends PropertyKey>(keyFn: (x: T) => K, collection: T[]): Record<K, T>;
