"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONSyntaxError = void 0;
const parse_1 = require("../../jsonc/parse");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
function cleanErrorMessage(error) {
    const message = 'rawMessage' in error ? error.rawMessage : error.message;
    return message.replace(/\s+at \d+:\d+/, '');
}
exports.JSONSyntaxError = {
    meta: {
        code: 'JSONSyntaxError',
        name: 'Enforce valid JSON',
        docs: {
            description: 'This check exists to prevent invalid JSON files in themes.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/json-syntax-error',
        },
        type: types_1.SourceCodeType.JSON,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
        deprecated: true,
    },
    create(context) {
        if (context.validateJSON)
            return {}; // If available, we'll use the JSON validator instead
        const error = context.file.ast;
        if (!(0, utils_1.isError)(error))
            return {};
        return {
            async onCodePathStart(file) {
                if (file.ast instanceof parse_1.JSONCParseErrors) {
                    for (const error of file.ast.errors) {
                        context.report({
                            message: jsoncParseErrorMessage(error.error),
                            startIndex: error.offset,
                            endIndex: error.offset + error.length,
                        });
                    }
                }
                else {
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
function jsoncParseErrorMessage(errorType) {
    switch (errorType) {
        case 1 /* ParseErrorCode.InvalidSymbol */:
            return 'Invalid symbol';
        case 2 /* ParseErrorCode.InvalidNumberFormat */:
            return 'Invalid number format';
        case 3 /* ParseErrorCode.PropertyNameExpected */:
            return 'Property name expected';
        case 4 /* ParseErrorCode.ValueExpected */:
            return 'Expecting a value';
        case 5 /* ParseErrorCode.ColonExpected */:
            return 'Expecting a colon after a property name (:)';
        case 6 /* ParseErrorCode.CommaExpected */:
            return 'Expecting a comma';
        case 7 /* ParseErrorCode.CloseBraceExpected */:
            return 'Expecting a closing brace (})';
        case 8 /* ParseErrorCode.CloseBracketExpected */:
            return 'Expecting a closing bracket (])';
        case 9 /* ParseErrorCode.EndOfFileExpected */:
            return 'Expecting end of file';
        case 10 /* ParseErrorCode.InvalidCommentToken */:
            return 'Invalid comment token';
        case 11 /* ParseErrorCode.UnexpectedEndOfComment */:
            return 'Unexpected end of comment';
        case 12 /* ParseErrorCode.UnexpectedEndOfString */:
            return 'Unexpected end of string';
        case 13 /* ParseErrorCode.UnexpectedEndOfNumber */:
            return 'Unexpected end of number';
        case 14 /* ParseErrorCode.InvalidUnicode */:
            return 'Invalid unicode';
        case 15 /* ParseErrorCode.InvalidEscapeCharacter */:
            return 'Invalid escape character';
        case 16 /* ParseErrorCode.InvalidCharacter */:
            return 'Invalid character';
        default:
            return 'Something went wrong with this JSON';
    }
}
//# sourceMappingURL=index.js.map