import lineColumn from 'line-column';
import { Position } from '../types';

export function getPosition(source: string, index: number): Position {
  const lineCol = lineColumn(source, { origin: 0 }).fromIndex(Math.min(index, source.length - 1));

  return {
    index,
    line: lineCol ? lineCol.line : -1,
    character: lineCol ? lineCol.col : -1,
  };
}

export function getOffset(source: string, line: number, column: number): number {
  return lineColumn(source, { origin: 1 }).toIndex(line, column);
}
