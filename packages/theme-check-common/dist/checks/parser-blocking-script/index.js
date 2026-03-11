"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserBlockingScript = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const types_1 = require("../../types");
const utils_1 = require("../../utils");
const utils_2 = require("../utils");
const suggestions_1 = require("./suggestions");
exports.ParserBlockingScript = {
    meta: {
        code: 'ParserBlockingScript',
        aliases: ['ParserBlockingScriptTag'],
        name: 'Avoid parser blocking scripts',
        docs: {
            description: 'They are bad ok?',
            recommended: true,
            url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/parser-blocking-javascript',
        },
        type: types_1.SourceCodeType.LiquidHtml,
        severity: types_1.Severity.ERROR,
        schema: {},
        targets: [],
    },
    create(context) {
        return {
            // {{ 'asset' | asset_url | script_tag }}
            LiquidFilter: async (node, ancestors) => {
                if (node.name !== 'script_tag')
                    return;
                const filterString = node.source.slice(node.position.start, node.position.end);
                const offset = filterString.indexOf('script_tag');
                const parentNode = (0, utils_1.last)(ancestors);
                const grandParentNode = (0, utils_1.last)(ancestors, -1);
                context.report({
                    message: 'The script_tag filter is parser-blocking. Use a <script> tag with async or defer for better performance',
                    startIndex: node.position.start + offset,
                    endIndex: node.position.end,
                    suggest: grandParentNode &&
                        grandParentNode.type === liquid_html_parser_1.NodeTypes.LiquidVariableOutput &&
                        parentNode &&
                        parentNode.type === liquid_html_parser_1.NodeTypes.LiquidVariable &&
                        (0, utils_1.last)(parentNode.filters) === node
                        ? [
                            (0, suggestions_1.liquidFilterSuggestion)('defer', node, parentNode, grandParentNode),
                            (0, suggestions_1.liquidFilterSuggestion)('async', node, parentNode, grandParentNode),
                        ]
                        : undefined,
                });
            },
            // <script src="...">
            HtmlRawNode: async (node) => {
                if (node.name !== 'script') {
                    return;
                }
                const hasSrc = node.attributes
                    .filter(utils_2.isValuedHtmlAttribute)
                    .some((attr) => (0, utils_2.isAttr)(attr, 'src'));
                if (!hasSrc) {
                    return;
                }
                const hasDeferOrAsync = node.attributes
                    .filter(utils_2.isHtmlAttribute)
                    .some((attr) => (0, utils_2.isAttr)(attr, 'async') || (0, utils_2.isAttr)(attr, 'defer'));
                const isTypeModule = node.attributes
                    .filter(utils_2.isValuedHtmlAttribute)
                    .some((attr) => (0, utils_2.isAttr)(attr, 'type') &&
                    ((0, utils_2.hasAttributeValueOf)(attr, 'module') || (0, utils_2.hasAttributeValueOf)(attr, 'importmap')));
                if (hasDeferOrAsync || isTypeModule) {
                    return;
                }
                context.report({
                    message: 'Avoid parser blocking scripts by adding `defer` or `async` on this tag',
                    startIndex: node.position.start,
                    endIndex: node.position.end,
                    suggest: [(0, suggestions_1.scriptTagSuggestion)('defer', node), (0, suggestions_1.scriptTagSuggestion)('async', node)],
                });
            },
        };
    },
};
//# sourceMappingURL=index.js.map