"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaticStylesheetAndJavascriptTags = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
exports.StaticStylesheetAndJavascriptTags = {
    meta: {
        code: 'StaticStylesheetAndJavascriptTags',
        name: 'Reports non static stylesheet and javascript tags',
        docs: {
            description: 'Reports the usage of Liquid within {% stylesheet %} and {% javascript %} tags, which should only contain static content.',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/static-stylesheet-and-javascript-tags',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            async LiquidRawTag(node) {
                if (node.name !== 'stylesheet' && node.name !== 'javascript') {
                    return;
                }
                const liquidNodes = node.body.nodes.filter((childNode) => childNode.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput ||
                    childNode.type === liquid_html_parser_1.NodeTypes.LiquidTag ||
                    childNode.type === liquid_html_parser_1.NodeTypes.LiquidRawTag);
                for (const liquidNode of liquidNodes) {
                    const tagType = node.name === 'stylesheet' ? 'CSS' : 'JavaScript';
                    const liquidType = liquidNode.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput ? 'variable' : 'tag';
                    context.report({
                        message: `Liquid ${liquidType} found in ${tagType} block. {% ${node.name} %} tags should only contain static ${tagType} code.`,
                        startIndex: liquidNode.position.start,
                        endIndex: liquidNode.position.end,
                    });
                }
            },
        };
    },
};
//# sourceMappingURL=index.js.map