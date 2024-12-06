import { ParseErrorCode, printParseErrorCode } from 'jsonc-parser';
import { JSONCParseErrors } from '../../jsonc/parse';
import { JSONCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isError } from '../../utils';

function cleanErrorMessage(error: Error) {
  const message = 'rawMessage' in error ? (error.rawMessage as string) : error.message;
  return message.replace(/\s+at \d+:\d+/, '');
}

export const JSONSyntaxError: JSONCheckDefinition = {
  meta: {
    code: 'JSONSyntaxError',
    name: 'Enforce valid JSON',
    docs: {
      description: 'This check exists to prevent invalid JSON files in themes.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/json-syntax-error',
    },
    type: SourceCodeType.JSON,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
    deprecated: true,
  },

  create(context) {
    if (context.validateJSON) return {}; // If available, we'll use the JSON validator instead

    const error = context.file.ast;
    if (!isError(error)) return {};

    return {
      async onCodePathStart(file) {
        if (file.ast instanceof JSONCParseErrors) {
          for (const error of file.ast.errors) {
            context.report({
              message: jsoncParseErrorMessage(error.error),
              startIndex: error.offset,
              endIndex: error.offset + error.length,
            });
          }
        } else {
          context.report({
            message: cleanErrorMessage(error),
            startIndex: 0,
            endIndex: file.source.length,
          });
        }
      },
    };
  },
};

function jsoncParseErrorMessage(errorType: ParseErrorCode) {
  switch (errorType) {
    case ParseErrorCode.InvalidSymbol:
      return 'Invalid symbol';
    case ParseErrorCode.InvalidNumberFormat:
      return 'Invalid number format';
    case ParseErrorCode.PropertyNameExpected:
      return 'Property name expected';
    case ParseErrorCode.ValueExpected:
      return 'Expecting a value';
    case ParseErrorCode.ColonExpected:
      return 'Expecting a colon after a property name (:)';
    case ParseErrorCode.CommaExpected:
      return 'Expecting a comma';
    case ParseErrorCode.CloseBraceExpected:
      return 'Expecting a closing brace (})';
    case ParseErrorCode.CloseBracketExpected:
      return 'Expecting a closing bracket (])';
    case ParseErrorCode.EndOfFileExpected:
      return 'Expecting end of file';
    case ParseErrorCode.InvalidCommentToken:
      return 'Invalid comment token';
    case ParseErrorCode.UnexpectedEndOfComment:
      return 'Unexpected end of comment';
    case ParseErrorCode.UnexpectedEndOfString:
      return 'Unexpected end of string';
    case ParseErrorCode.UnexpectedEndOfNumber:
      return 'Unexpected end of number';
    case ParseErrorCode.InvalidUnicode:
      return 'Invalid unicode';
    case ParseErrorCode.InvalidEscapeCharacter:
      return 'Invalid escape character';
    case ParseErrorCode.InvalidCharacter:
      return 'Invalid character';
    default:
      return 'Something went wrong with this JSON';
  }
}
