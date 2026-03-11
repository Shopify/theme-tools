"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isError = isError;
exports.asError = asError;
const PARSE_ERROR_MESSAGES = {
    [1 /* ParseErrorCode.InvalidSymbol */]: 'Invalid symbol found in the input.',
    [2 /* ParseErrorCode.InvalidNumberFormat */]: 'Invalid number format detected.',
    [3 /* ParseErrorCode.PropertyNameExpected */]: 'Property name expected but not found.',
    [4 /* ParseErrorCode.ValueExpected */]: 'A value was expected but not found.',
    [5 /* ParseErrorCode.ColonExpected */]: 'Colon `:` expected after the property name.',
    [6 /* ParseErrorCode.CommaExpected */]: 'Comma `,` expected between elements and properties.',
    [7 /* ParseErrorCode.CloseBraceExpected */]: 'Closing brace `}` expected.',
    [8 /* ParseErrorCode.CloseBracketExpected */]: 'Closing bracket `]` expected.',
    [9 /* ParseErrorCode.EndOfFileExpected */]: 'End of file expected.',
    [10 /* ParseErrorCode.InvalidCommentToken */]: 'Invalid comment token found.',
    [11 /* ParseErrorCode.UnexpectedEndOfComment */]: 'Unexpected end of comment.',
    [12 /* ParseErrorCode.UnexpectedEndOfString */]: 'Unexpected end of string.',
    [13 /* ParseErrorCode.UnexpectedEndOfNumber */]: 'Unexpected end of number.',
    [14 /* ParseErrorCode.InvalidUnicode */]: 'Invalid Unicode escape sequence.',
    [15 /* ParseErrorCode.InvalidEscapeCharacter */]: 'Invalid escape character found.',
    [16 /* ParseErrorCode.InvalidCharacter */]: 'Invalid character found in the input.',
};
function isError(error) {
    return error instanceof Error;
}
function asError(error) {
    if (error instanceof Error) {
        return error;
    }
    if (typeof error === 'string') {
        return new Error(error);
    }
    if (error && typeof error === 'object' && 'error' in error) {
        return new Error(getParseErrorMessage(error));
    }
    if (error && typeof error.toString === 'function') {
        return new Error(error.toString());
    }
    return new Error('An unknown error occurred');
}
function getParseErrorMessage(parseError) {
    return PARSE_ERROR_MESSAGES[parseError.error] || 'Unknown parse error.';
}
//# sourceMappingURL=error.js.map