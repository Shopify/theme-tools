"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidStaticBlockType = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const file_utils_1 = require("../../utils/file-utils");
const markup_1 = require("../../utils/markup");
exports.ValidStaticBlockType = {
    meta: {
        code: 'ValidStaticBlockType',
        name: 'Prevent use of type that is not valid for static blocks',
        docs: {
            description: 'This check is aimed at preventing the use of an invalid type for blocks rendered statically.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-static-block-type',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidTag(node) {
                if (node.name !== 'content_for') {
                    return;
                }
                if (!(0, markup_1.isContentForBlock)(node.markup)) {
                    return;
                }
                const typeArg = node.markup.args.find((arg) => arg.name === 'type');
                if (!typeArg) {
                    return; // covered by VariableContentForArguments
                }
                const typeArgValueNode = typeArg.value;
                if (typeArgValueNode.type !== liquid_html_parser_1.NodeTypes.String) {
                    return; // covered by VariableContentForArguments
                }
                const blockName = typeArgValueNode.value;
                const relativePath = `blocks/${blockName}.liquid`;
                const fileExists = await (0, file_utils_1.doesFileExist)(context, relativePath);
                if (!fileExists) {
                    context.report({
                        message: `'blocks/${blockName}.liquid' does not exist`,
                        startIndex: typeArgValueNode.position.start,
                        endIndex: typeArgValueNode.position.end,
                        suggest: [],
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map