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
    const start = lc.fromIndex(startIndex);
    const end = lc.fromIndex(Math.min(endIndex, source.length - 1));

    // Plugging ourselves into @babel/code-frame since this is how
    // the babel parser can print where the parsing error occured.
    // https://github.com/prettier/prettier/blob/cd4a57b113177c105a7ceb94e71f3a5a53535b81/src/main/parser.js
    this.loc = {
      start: {
        line: start!.line,
        column: start!.col,
      },
      end: {
        line: end!.line,
        column: end!.col,
      },
    };
  }
}
