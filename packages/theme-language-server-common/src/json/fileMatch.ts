export function uriMatch(uri: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(uri));
}
