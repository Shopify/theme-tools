export function isCovered(offset: number, range: { start: number; end: number }): boolean {
  return range.start <= offset && offset <= range.end;
}
