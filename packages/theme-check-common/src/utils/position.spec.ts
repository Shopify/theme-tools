import { describe, expect, it } from 'vitest';
import { getPosition } from './position';

describe('Unit: getPosition', () => {
  it('returns the line and character of an index', () => {
    expect(getPosition('a\nbc', 3)).toEqual({ index: 3, line: 1, character: 1 });
  });

  it('returns the position of the end of the file', () => {
    expect(getPosition('a\nbc', 4)).toEqual({ index: 4, line: 1, character: 2 });
    expect(getPosition('a\n', 2)).toEqual({ index: 2, line: 1, character: 0 });
    expect(getPosition('', 0)).toEqual({ index: 0, line: 0, character: 0 });
    expect(getPosition('a\nbc', 9)).toEqual({ index: 9, line: 1, character: 2 });
  });

  it('ends a line at the \\n of a Windows line break', () => {
    expect(getPosition('a\r\nbc', 2)).toEqual({ index: 2, line: 0, character: 2 });
    expect(getPosition('a\r\nbc', 4)).toEqual({ index: 4, line: 1, character: 1 });
    expect(getPosition('a\r\n', 3)).toEqual({ index: 3, line: 1, character: 0 });
  });

  it('returns -1 for a negative index', () => {
    expect(getPosition('a\nbc', -1)).toEqual({ index: -1, line: -1, character: -1 });
  });
});
