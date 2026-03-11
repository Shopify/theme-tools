"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsers = exports.liquidHtmlParser = exports.liquidHtmlLanguageName = exports.liquidHtmlAstFormat = void 0;
exports.parse = parse;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("./utils");
function parse(text) {
    return (0, liquid_html_parser_1.toLiquidHtmlAST)(text);
}
exports.liquidHtmlAstFormat = 'liquid-html-ast';
exports.liquidHtmlLanguageName = 'liquid-html';
exports.liquidHtmlParser = {
    parse,
    astFormat: exports.liquidHtmlAstFormat,
    locStart: utils_1.locStart,
    locEnd: utils_1.locEnd,
};
exports.parsers = {
    [exports.liquidHtmlLanguageName]: exports.liquidHtmlParser,
};
//# sourceMappingURL=parser.js.map