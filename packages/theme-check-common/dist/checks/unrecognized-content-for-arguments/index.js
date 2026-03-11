"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnrecognizedContentForArguments = void 0;
const types_1 = require("../../types");
const arguments_1 = require("../../liquid-doc/arguments");
const content_for_1 = require("../../tags/content-for");
exports.UnrecognizedContentForArguments = {
    meta: {
        code: 'UnrecognizedContentForArguments',
        name: 'Unrecognized ContentFor Arguments',
        docs: {
            description: 'This check ensures that no unknown arguments are used when rendering a static block.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unrecognized-content-for-arguments',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.WARNING,
        schema: {},
        targets: [],
    },
    create(context) {
        const DEFAULT_CONTENT_FOR_ARGS = new Set([
            ...content_for_1.RESERVED_CONTENT_FOR_ARGUMENTS,
            ...content_for_1.REQUIRED_CONTENT_FOR_ARGUMENTS,
        ]);
        return {
            async ContentForMarkup(node) {
                const blockName = (0, arguments_1.getBlockName)(node);
                if (!blockName)
                    return;
                const liquidDocParameters = await (0, arguments_1.getLiquidDocParams)(context, `blocks/${blockName}.liquid`);
                if (!liquidDocParameters)
                    return;
                const unknownProvidedParams = node.args
                    .filter((p) => !liquidDocParameters.has(p.name))
                    .filter((p) => !DEFAULT_CONTENT_FOR_ARGS.has(p.name))
                    .filter((p) => !p.name.startsWith(content_for_1.CLOSEST_ARGUMENT));
                (0, arguments_1.reportUnknownArguments)(context, node, unknownProvidedParams, blockName);
            },
        };
    },
};
//# sourceMappingURL=index.js.map