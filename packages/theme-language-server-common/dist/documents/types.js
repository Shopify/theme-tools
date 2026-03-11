"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isJsonSourceCode = exports.isLiquidSourceCode = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const isLiquidSourceCode = (file) => file.type === theme_check_common_1.SourceCodeType.LiquidHtml;
exports.isLiquidSourceCode = isLiquidSourceCode;
const isJsonSourceCode = (file) => file.type === theme_check_common_1.SourceCodeType.JSON;
exports.isJsonSourceCode = isJsonSourceCode;
//# sourceMappingURL=types.js.map