import { ParseError, ParseErrorCode } from 'jsonc-parser';

const PARSE_ERROR_MESSAGES: Record<ParseErrorCode, string> = {
  [ParseErrorCode.InvalidSymbol]: 'Invalid symbol found in the input.',
  [ParseErrorCode.InvalidNumberFormat]: 'Invalid number format detected.',
  [ParseErrorCode.PropertyNameExpected]: 'Property name expected but not found.',
  [ParseErrorCode.ValueExpected]: 'A value was expected but not found.',
  [ParseErrorCode.ColonExpected]: 'Colon `:` expected after the property name.',
  [ParseErrorCode.CommaExpected]: 'Comma `,` expected between elements and properties.',
  [ParseErrorCode.CloseBraceExpected]: 'Closing brace `}` expected.',
  [ParseErrorCode.CloseBracketExpected]: 'Closing bracket `]` expected.',
  [ParseErrorCode.EndOfFileExpected]: 'End of file expected.',
  [ParseErrorCode.InvalidCommentToken]: 'Invalid comment token found.',
  [ParseErrorCode.UnexpectedEndOfComment]: 'Unexpected end of comment.',
  [ParseErrorCode.UnexpectedEndOfString]: 'Unexpected end of string.',
  [ParseErrorCode.UnexpectedEndOfNumber]: 'Unexpected end of number.',
  [ParseErrorCode.InvalidUnicode]: 'Invalid Unicode escape sequence.',
  [ParseErrorCode.InvalidEscapeCharacter]: 'Invalid escape character found.',
  [ParseErrorCode.InvalidCharacter]: 'Invalid character found in the input.',
};

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (error && typeof error === 'object' && 'error' in error) {
    return new Error(getParseErrorMessage(error as ParseError));
  }

  if (error && typeof error.toString === 'function') {
    return new Error(error.toString());
  }

  return new Error('An unknown error occurred');
}

function getParseErrorMessage(parseError: ParseError): string {
  return PARSE_ERROR_MESSAGES[parseError.error] || 'Unknown parse error.';
}
