export function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

export function last<T>(arr: T[], offset: number = 0): T | undefined {
  return arr[arr.length - 1 + offset];
}

export function findLast<T, NT extends T>(array: T[], pred: (n: T) => n is NT): NT | undefined;
export function findLast<T>(array: T[], pred: (n: T) => boolean): T | undefined {
  return array[findLastIndex(array, pred)];
}

export function findLastIndex<T>(array: T[], pred: (n: T) => boolean): number {
  for (let i = array.length - 1; i >= 0; i--) {
    if (pred(array[i])) return i;
  }
  return -1;
}

export function findLastAndIndex<T, NT extends T>(
  array: T[],
  pred: (n: T) => n is NT,
): [NT, number] | [undefined, -1];
export function findLastAndIndex<T>(
  array: T[],
  pred: (n: T) => boolean,
): [T, number] | [undefined, -1] {
  const index = findLastIndex(array, pred);
  return [array[index], index];
}
