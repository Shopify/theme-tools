"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isLiquidRequestContext = isLiquidRequestContext;
exports.isJSONRequestContext = isJSONRequestContext;
const theme_check_common_1 = require("@shopify/theme-check-common");
function isLiquidRequestContext(context) {
    const { doc, schema, parsed } = context;
    return (doc.type === theme_check_common_1.SourceCodeType.LiquidHtml && !!schema && !(0, theme_check_common_1.isError)(doc.ast) && !(0, theme_check_common_1.isError)(parsed));
}
function isJSONRequestContext(context) {
    const { doc } = context;
    return doc.type === theme_check_common_1.SourceCodeType.JSON && !(0, theme_check_common_1.isError)(doc.ast);
}
//# sourceMappingURL=RequestContext.js.map