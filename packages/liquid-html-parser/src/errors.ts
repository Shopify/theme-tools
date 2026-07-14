import lineColumn from 'line-column';
import { NodeTypes } from './types';
import type { Position } from './types';

interface LineColPosition {
  line: number;
  column: number;
}

export type UnclosedNode = { type: NodeTypes; name: string; blockStartPosition: Position };

export class LiquidHTMLASTParsingError extends SyntaxError {
  loc?: { start: LineColPosition; end: LineColPosition };
  unclosed: UnclosedNode | null;

  constructor(
    message: string,
    source: string,
    startIndex: number,
    endIndex: number,
    unclosed?: UnclosedNode,
  ) {
    super(message);
    this.name = 'LiquidHTMLParsingError';
    this.unclosed = unclosed ?? null;

    const lc = lineColumn(source);

    /*
     * A parse can fail at a position that is out of the source's range - for
     * example the end-of-input token that sits past the last character when a
     * closing delimiter like "%}" is never found, or a -1 sentinel position.
     * line-column returns null for an out-of-range index, and dereferencing
     * that null while building `loc` below would throw a TypeError ("Cannot
     * read properties of null") that masks the real syntax error. Clamp the
     * indices into the valid range before the lookup so we always produce a
     * real location.
     */
    const lastIndex = Math.max(0, source.length - 1);
    const start = lc.fromIndex(Math.min(Math.max(startIndex, 0), lastIndex));
    const end = lc.fromIndex(Math.min(Math.max(endIndex, 0), lastIndex));

    // Plugging ourselves into @babel/code-frame since this is how
    // the babel parser can print where the parsing error occured.
    // https://github.com/prettier/prettier/blob/cd4a57b113177c105a7ceb94e71f3a5a53535b81/src/main/parser.js
    this.loc = {
      start: {
        line: start?.line ?? 1,
        column: start?.col ?? 1,
      },
      end: {
        line: end?.line ?? 1,
        column: end?.col ?? 1,
      },
    };
  }
}
