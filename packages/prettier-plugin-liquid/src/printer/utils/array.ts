export function last<T>(x: T[]): T {
  return x[x.length - 1];
}

export function first<T>(x: T[]): T {
  return x[0];
}

export function intersperse<T>(array: T[], delim: T): T[] {
  return array.flatMap((val) => [delim, val]).slice(1);
}

export function isEmpty(col: any[]): boolean {
  return col.length === 0;
}
