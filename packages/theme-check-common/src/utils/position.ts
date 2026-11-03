import lineColumn from 'line-column';
import { Position } from '../types';

/**
 * The line and character of an index, both 0-based. An index past the end of
 * the source is at its end, and a negative one, like the end of an unclosed
 * block, has line and character -1.
 */
export function getPosition(source: string, index: number): Position {
  if (index < 0) return { index, line: -1, character: -1 };
  // Not lineColumn's fromIndex, which has no position for the end of the file,
  // and splits the whole source on every call.
  const end = Math.min(index, source.length);
  let line = 0;
  let lineStart = 0;
  for (let i = source.indexOf('\n'); i !== -1 && i < end; i = source.indexOf('\n', i + 1)) {
    line++;
    lineStart = i + 1;
  }
  return { index, line, character: end - lineStart };
}

export function getOffset(source: string, line: number, column: number): number {
  return lineColumn(source, { origin: 1 }).toIndex(line, column);
}
