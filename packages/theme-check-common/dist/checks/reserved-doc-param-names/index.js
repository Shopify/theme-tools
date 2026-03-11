"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservedDocParamNames = void 0;
const types_1 = require("../../types");
const to_schema_1 = require("../../to-schema");
const content_for_1 = require("../../tags/content-for");
exports.ReservedDocParamNames = {
    meta: {
        code: 'ReservedDocParamNames',
        name: 'Valid doc parameter names',
        docs: {
            description: 'This check exists to ensure any parameter names defined in LiquidDoc do not collide with reserved words.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/reserved-doc-param-names',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        if (!(0, to_schema_1.isBlock)(context.file.uri)) {
            return {};
        }
        const defaultParameterNames = [
            ...content_for_1.REQUIRED_CONTENT_FOR_ARGUMENTS,
            ...content_for_1.RESERVED_CONTENT_FOR_ARGUMENTS,
        ];
        return {
            async LiquidDocParamNode(node) {
                const paramName = node.paramName.value;
                if (defaultParameterNames.includes(paramName)) {
                    reportWarning(context, `The parameter name is not supported because it's a reserved argument for 'content_for' tags.`, node.paramName);
                }
            },
        };
    },
};
function reportWarning(context, message, node) {
    context.report({
        message,
        startIndex: node.position.start,
        endIndex: node.position.end,
    });
}
//# sourceMappingURL=index.js.map