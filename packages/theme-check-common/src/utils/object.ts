export function deepGet(obj: any, path: (string | number)[]): any {
  return path.reduce((acc, key) => acc?.[key], obj);
}
