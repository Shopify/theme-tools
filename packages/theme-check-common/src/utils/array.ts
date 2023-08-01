export function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

export function last<T>(arr: T[], offset: number = 0): T | undefined {
  return arr[arr.length - 1 + offset];
}
