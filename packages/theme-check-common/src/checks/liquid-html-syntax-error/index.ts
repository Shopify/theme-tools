import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import { getOffset, isError } from '../../utils';
import { detectMultipleAssignValues } from './checks/MultipleAssignValues';
import { detectInvalidBooleanExpressions } from './checks/InvalidBooleanExpressions';
import { detectInvalidEchoValue } from './checks/InvalidEchoValue';

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
    const ast = context.file.ast;
    if (!isError(ast)) {
      return {
        async BooleanExpression(node, ancestors) {
          const problem = detectInvalidBooleanExpressions(node, ancestors);

          if (!problem) {
            return;
          }

          context.report(problem);
        },
        async LiquidTag(node) {
          const problem = detectMultipleAssignValues(node) || detectInvalidEchoValue(node);

          if (!problem) {
            return;
          }

          context.report(problem);
        },
        async LiquidVariableOutput(node) {
          const problem = detectInvalidEchoValue(node);

          if (!problem) {
            return;
          }

          context.report(problem);
        },
      };
    }

    return {
      async onCodePathStart(file) {
        if (isParsingErrorWithLocation(ast)) {
          const { start, end } = ast.loc;
          const startIndex = getOffset(file.source, start.line, start.column);
          let endIndex = getOffset(file.source, end.line, end.column);
          if (startIndex === endIndex) endIndex += 1;
          const highlight = file.source.slice(startIndex, endIndex);
          context.report({
            message: cleanErrorMessage(ast.message, highlight),
            startIndex,
            endIndex: endIndex,
          });
        } else {
          context.report({
            message: ast.message,
            startIndex: 0,
            endIndex: file.source.length,
          });
        }
      },
    };
  },
};
