import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import { getOffset, isError } from '../../utils';

type LineColPosition = {
  line: number;
  column: number;
};

function isParsingErrorWithLocation(
  error: Error,
): error is Error & { loc: { start: LineColPosition; end: LineColPosition } } {
  return 'name' in error && error.name === 'LiquidHTMLParsingError' && 'loc' in error;
}

function cleanErrorMessage(message: string, highlight: string): string {
  return message
    .replace(/Line \d+, col \d+:\s+/, 'SyntaxError: ')
    .replace(/(?!<expected ".+",) not .*/, ` not "${highlight}"`);
}

export const LiquidHTMLSyntaxError: LiquidCheckDefinition = {
  meta: {
    code: 'LiquidHTMLSyntaxError',
    aliases: ['SyntaxError', 'HtmlParsingError'],
    name: 'Prevent LiquidHTML Syntax Errors',
    docs: {
      description: 'This check exists to inform the user of Liquid HTML syntax errors.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const error = context.file.ast;
    if (!isError(error)) return {};

    return {
      async onCodePathStart(file) {
        if (isParsingErrorWithLocation(error)) {
          const { start, end } = error.loc;
          const startIndex = getOffset(file.source, start.line, start.column);
          let endIndex = getOffset(file.source, end.line, end.column);
          if (startIndex === endIndex) endIndex += 1;
          const highlight = file.source.slice(startIndex, endIndex);
          context.report({
            message: cleanErrorMessage(error.message, highlight),
            startIndex,
            endIndex: endIndex,
          });
        } else {
          context.report({
            message: error.message,
            startIndex: 0,
            endIndex: file.source.length,
          });
        }
      },
    };
  },
};
