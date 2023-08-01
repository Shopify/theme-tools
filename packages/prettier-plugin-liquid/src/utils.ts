import { Position } from '~/types';

export function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${(x as any).type}`);
}

export function locStart(node: { position: Position }) {
  return node.position.start;
}

export function locEnd(node: { position: Position }) {
  return node.position.end;
}

export function deepGet<T = any>(path: (string | number)[], obj: any): T {
  return path.reduce((curr: any, k: string | number) => {
    if (curr && curr[k] !== undefined) return curr[k];
    return undefined;
  }, obj);
}

export function dropLast<T>(n: number, xs: readonly T[]) {
  const result = [...xs];
  for (let i = 0; i < n; i++) {
    result.pop();
  }
  return result;
}
