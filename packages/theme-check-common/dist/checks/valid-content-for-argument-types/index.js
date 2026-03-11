"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidContentForArgumentTypes = void 0;
const types_1 = require("../../types");
const arguments_1 = require("../../liquid-doc/arguments");
exports.ValidContentForArgumentTypes = {
    meta: {
        code: 'ValidContentForArgumentTypes',
        name: 'Valid ContentFor Argument Types',
        docs: {
            description: 'This check ensures that arguments passed to static blocks match the expected types defined in the liquidDoc header if present.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-content-for-argument-types',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async ContentForMarkup(node) {
                const blockName = (0, arguments_1.getBlockName)(node);
                if (!blockName)
                    return;
                const liquidDocParameters = await (0, arguments_1.getLiquidDocParams)(context, `blocks/${blockName}.liquid`);
                if (!liquidDocParameters)
                    return;
                const typeMismatchParams = (0, arguments_1.findTypeMismatchParams)(liquidDocParameters, node.args);
                (0, arguments_1.reportTypeMismatches)(context, typeMismatchParams, liquidDocParameters);
            },
        };
    },
};
//# sourceMappingURL=index.js.map