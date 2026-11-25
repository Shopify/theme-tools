import { expect } from 'vitest';
import type { LiquidHtmlNode } from '../ast';
import { deepGet } from '../utils';

export function expectPath(ast: LiquidHtmlNode, path: string) {
  return expect(deepGet(path.split('.'), ast));
}

export function expectPosition(ast: LiquidHtmlNode, path: string) {
  const start = deepGet((path + '.position.start').split('.'), ast) as number;
  const end = deepGet((path + '.position.end').split('.'), ast) as number;
  return expect(ast.source.slice(start, end));
}
