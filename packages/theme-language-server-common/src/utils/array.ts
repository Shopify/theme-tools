// Array.prototype.findLast is only available in es2023. Which feels too new?
export function findLast<T>(array: T[], pred: (n: T) => boolean): T | undefined {
  for (let i = array.length - 1; i >= 0; i--) {
    if (pred(array[i])) return array[i];
  }
}
