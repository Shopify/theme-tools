"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printers3 = exports.printers2 = void 0;
const printer_liquid_html_1 = require("./printer-liquid-html");
const parser_1 = require("../parser");
exports.printers2 = {
    [parser_1.liquidHtmlAstFormat]: printer_liquid_html_1.printerLiquidHtml2,
};
exports.printers3 = {
    [parser_1.liquidHtmlAstFormat]: printer_liquid_html_1.printerLiquidHtml3,
};
//# sourceMappingURL=index.js.map