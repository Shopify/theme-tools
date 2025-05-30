export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function assertNever(module: never) {
  throw new Error(`Unknown module type ${module}`);
}
