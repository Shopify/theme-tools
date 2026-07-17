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

export function sourceAt(source: string, position: { start: number; end: number }): string {
  return source.slice(position.start, position.end);
}

export function expectBlockStartPosition(ast: LiquidHtmlNode, path: string) {
  const start = deepGet((path + '.blockStartPosition.start').split('.'), ast) as number;
  const end = deepGet((path + '.blockStartPosition.end').split('.'), ast) as number;
  return expect(ast.source.slice(start, end));
}

export function expectBlockEndPosition(ast: LiquidHtmlNode, path: string) {
  const start = deepGet((path + '.blockEndPosition.start').split('.'), ast) as number;
  const end = deepGet((path + '.blockEndPosition.end').split('.'), ast) as number;
  return expect(ast.source.slice(start, end));
}
