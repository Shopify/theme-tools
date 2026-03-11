"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniqueStaticBlockId = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const markup_1 = require("../../utils/markup");
exports.UniqueStaticBlockId = {
    meta: {
        code: 'UniqueStaticBlockId',
        name: 'Prevent use of duplicated ids for blocks rendered statically',
        docs: {
            description: 'This check is aimed at preventing the use of duplicated ids for blocks rendered statically.',
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/unique-static-block-id',
            recommended: true,
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        const usedIds = new Set();
        const idRegex = /id:\s*["'](\S+)["']/;
        return {
            async LiquidTag(node) {
                if (node.name !== liquid_html_parser_1.NamedTags.content_for) {
                    return;
                }
                if (!(0, markup_1.isContentForBlock)(node.markup)) {
                    return;
                }
                const idNode = node.markup.args.find((arg) => arg.name === 'id');
                if (!idNode) {
                    return; // covered by VariableContentForArguments
                }
                const idValueNode = idNode.value;
                if (idValueNode.type !== liquid_html_parser_1.NodeTypes.String) {
                    return; // covered by VariableContentForArguments
                }
                const id = idValueNode.value;
                if (usedIds.has(id)) {
                    context.report({
                        message: `The id '${id}' is already being used by another static block`,
                        startIndex: idValueNode.position.start,
                        endIndex: idValueNode.position.end,
                        suggest: [],
                    });
                }
                else {
                    usedIds.add(id);
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map