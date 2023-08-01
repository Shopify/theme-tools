import { MatchResult } from 'ohm-js';
import lineColumn from 'line-column';

interface LineColPosition {
  line: number;
  column: number;
}

export class LiquidHTMLCSTParsingError extends SyntaxError {
  loc?: { start: LineColPosition; end: LineColPosition };

  constructor(ohm: MatchResult) {
    super(ohm.shortMessage);
    this.name = 'LiquidHTMLParsingError';

    const input = (ohm as any).input;
    const errorPos = (ohm as any)._rightmostFailurePosition;
    const lineCol = lineColumn(input).fromIndex(
      Math.min(errorPos, input.length - 1),
    );

    // Plugging ourselves into @babel/code-frame since this is how
    // the babel parser can print where the parsing error occured.
    // https://github.com/prettier/prettier/blob/cd4a57b113177c105a7ceb94e71f3a5a53535b81/src/main/parser.js
    if (lineCol) {
      this.loc = {
        start: {
          line: lineCol.line,
          column: lineCol.col,
        },
        end: {
          line: lineCol.line,
          column: lineCol.col,
        },
      };
    }
  }
}

export class LiquidHTMLASTParsingError extends SyntaxError {
  loc?: { start: LineColPosition; end: LineColPosition };

  constructor(
    message: string,
    source: string,
    startIndex: number,
    endIndex: number,
  ) {
    super(message);
    this.name = 'LiquidHTMLParsingError';

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
