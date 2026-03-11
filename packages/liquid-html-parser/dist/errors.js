"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidHTMLASTParsingError = exports.LiquidHTMLCSTParsingError = void 0;
const line_column_1 = __importDefault(require("line-column"));
class LiquidHTMLCSTParsingError extends SyntaxError {
    constructor(ohm) {
        super(ohm.shortMessage);
        this.name = 'LiquidHTMLParsingError';
        const input = ohm.input;
        const errorPos = ohm._rightmostFailurePosition;
        const lineCol = (0, line_column_1.default)(input).fromIndex(Math.min(errorPos, input.length - 1));
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
exports.LiquidHTMLCSTParsingError = LiquidHTMLCSTParsingError;
class LiquidHTMLASTParsingError extends SyntaxError {
    constructor(message, source, startIndex, endIndex, unclosed) {
        super(message);
        this.name = 'LiquidHTMLParsingError';
        this.unclosed = unclosed !== null && unclosed !== void 0 ? unclosed : null;
        const lc = (0, line_column_1.default)(source);
        const start = lc.fromIndex(startIndex);
        const end = lc.fromIndex(Math.min(endIndex, source.length - 1));
        // Plugging ourselves into @babel/code-frame since this is how
        // the babel parser can print where the parsing error occured.
        // https://github.com/prettier/prettier/blob/cd4a57b113177c105a7ceb94e71f3a5a53535b81/src/main/parser.js
        this.loc = {
            start: {
                line: start.line,
                column: start.col,
            },
            end: {
                line: end.line,
                column: end.col,
            },
        };
    }
}
exports.LiquidHTMLASTParsingError = LiquidHTMLASTParsingError;
//# sourceMappingURL=errors.js.map