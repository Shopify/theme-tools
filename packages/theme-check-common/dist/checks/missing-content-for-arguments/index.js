"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingContentForArguments = void 0;
const types_1 = require("../../types");
const arguments_1 = require("../../liquid-doc/arguments");
exports.MissingContentForArguments = {
    meta: {
        code: 'MissingContentForArguments',
        name: 'Missing ContentFor Arguments',
        docs: {
            description: 'This check ensures that all required arguments are provided when rendering a static block.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-content-for-arguments',
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
                const providedParams = new Map(node.args.map((arg) => [arg.name, arg]));
                const missingRequiredParams = Array.from(liquidDocParameters.values()).filter((p) => p.required && !providedParams.has(p.name));
                (0, arguments_1.reportMissingArguments)(context, node, missingRequiredParams, blockName);
            },
        };
    },
};
//# sourceMappingURL=index.js.map