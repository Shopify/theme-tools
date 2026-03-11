"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.augmentWithCSSProperties = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const constants_evaluate_1 = require("../../constants.evaluate");
const utils_1 = require("../../utils");
function getCssDisplayFromComment(body) {
    return body.match(/^\s*display:\s*([a-z]+)\s*$/)?.[1];
}
function getCssWhitespaceFromComment(body) {
    return body.match(/^\s*white-?space:\s*([a-z]+)\s*$/)?.[1];
}
function getCssDisplay(node, options) {
    if (node.prev && node.prev.type === liquid_html_parser_1.NodeTypes.HtmlComment) {
        // <!-- display: block -->
        const cssDisplay = getCssDisplayFromComment(node.prev.body);
        if (cssDisplay) {
            return cssDisplay;
        }
    }
    if (node.prev && node.prev.type === liquid_html_parser_1.NodeTypes.LiquidTag && node.prev.name === '#') {
        // {% # display: block %}
        const cssDisplay = getCssDisplayFromComment(node.prev.markup);
        if (cssDisplay) {
            return cssDisplay;
        }
    }
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.HtmlElement:
        case liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose:
        case liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement: {
            switch (options.htmlWhitespaceSensitivity) {
                case 'strict':
                    return 'inline';
                case 'ignore':
                    return 'block';
                default: {
                    return ((node.name.length === 1 &&
                        node.name[0].type === liquid_html_parser_1.NodeTypes.TextNode &&
                        constants_evaluate_1.CSS_DISPLAY_TAGS[node.name[0].value]) ||
                        constants_evaluate_1.CSS_DISPLAY_DEFAULT);
                }
            }
        }
        case liquid_html_parser_1.NodeTypes.HtmlVoidElement:
        case liquid_html_parser_1.NodeTypes.HtmlRawNode: {
            switch (options.htmlWhitespaceSensitivity) {
                case 'strict':
                    return 'inline';
                case 'ignore':
                    return 'block';
                default: {
                    return constants_evaluate_1.CSS_DISPLAY_TAGS[node.name] || constants_evaluate_1.CSS_DISPLAY_DEFAULT;
                }
            }
        }
        case liquid_html_parser_1.NodeTypes.RawMarkup:
        case liquid_html_parser_1.NodeTypes.TextNode:
            return 'inline';
        case liquid_html_parser_1.NodeTypes.LiquidTag:
        case liquid_html_parser_1.NodeTypes.LiquidRawTag:
            switch (options.htmlWhitespaceSensitivity) {
                case 'strict':
                    return 'inline';
                case 'ignore':
                    return 'block';
                default: {
                    return constants_evaluate_1.CSS_DISPLAY_LIQUID_TAGS[node.name] || constants_evaluate_1.CSS_DISPLAY_LIQUID_DEFAULT;
                }
            }
        case liquid_html_parser_1.NodeTypes.LiquidBranch:
        case liquid_html_parser_1.NodeTypes.LiquidVariableOutput:
            return 'inline';
        case liquid_html_parser_1.NodeTypes.AttrDoubleQuoted:
        case liquid_html_parser_1.NodeTypes.AttrSingleQuoted:
        case liquid_html_parser_1.NodeTypes.AttrUnquoted:
        case liquid_html_parser_1.NodeTypes.AttrEmpty:
            return 'inline';
        case liquid_html_parser_1.NodeTypes.HtmlDoctype:
        case liquid_html_parser_1.NodeTypes.HtmlComment:
            return 'block';
        case liquid_html_parser_1.NodeTypes.Document:
            return 'block';
        case liquid_html_parser_1.NodeTypes.YAMLFrontmatter:
            return 'block';
        case liquid_html_parser_1.NodeTypes.LiquidVariable:
        case liquid_html_parser_1.NodeTypes.LiquidFilter:
        case liquid_html_parser_1.NodeTypes.NamedArgument:
        case liquid_html_parser_1.NodeTypes.LiquidLiteral:
        case liquid_html_parser_1.NodeTypes.BooleanExpression:
        case liquid_html_parser_1.NodeTypes.String:
        case liquid_html_parser_1.NodeTypes.Number:
        case liquid_html_parser_1.NodeTypes.Range:
        case liquid_html_parser_1.NodeTypes.VariableLookup:
        case liquid_html_parser_1.NodeTypes.AssignMarkup:
        case liquid_html_parser_1.NodeTypes.CycleMarkup:
        case liquid_html_parser_1.NodeTypes.ContentForMarkup:
        case liquid_html_parser_1.NodeTypes.ForMarkup:
        case liquid_html_parser_1.NodeTypes.PaginateMarkup:
        case liquid_html_parser_1.NodeTypes.RenderMarkup:
        case liquid_html_parser_1.NodeTypes.RenderVariableExpression:
        case liquid_html_parser_1.NodeTypes.RenderAliasExpression:
        case liquid_html_parser_1.NodeTypes.LogicalExpression:
        case liquid_html_parser_1.NodeTypes.Comparison:
        case liquid_html_parser_1.NodeTypes.LiquidDocParamNode:
        case liquid_html_parser_1.NodeTypes.LiquidDocExampleNode:
        case liquid_html_parser_1.NodeTypes.LiquidDocDescriptionNode:
        case liquid_html_parser_1.NodeTypes.LiquidDocPromptNode:
            return 'should not be relevant';
        default:
            return (0, utils_1.assertNever)(node);
    }
}
function getNodeCssStyleWhiteSpace(node, options) {
    if (node.prev && node.prev.type === liquid_html_parser_1.NodeTypes.HtmlComment) {
        // <!-- white-space: normal -->
        const whitespace = getCssWhitespaceFromComment(node.prev.body);
        if (whitespace) {
            return whitespace;
        }
    }
    if (node.prev && node.prev.type === liquid_html_parser_1.NodeTypes.LiquidTag && node.prev.name === '#') {
        // {% # white-space: normal %}
        const whitespace = getCssWhitespaceFromComment(node.prev.markup);
        if (whitespace) {
            return whitespace;
        }
    }
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.HtmlElement:
        case liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose:
        case liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement: {
            return ((node.name.length === 1 &&
                node.name[0].type === liquid_html_parser_1.NodeTypes.TextNode &&
                constants_evaluate_1.CSS_WHITE_SPACE_TAGS[node.name[0].value]) ||
                constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT);
        }
        case liquid_html_parser_1.NodeTypes.HtmlVoidElement:
        case liquid_html_parser_1.NodeTypes.HtmlRawNode: {
            return constants_evaluate_1.CSS_WHITE_SPACE_TAGS[node.name] || constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT;
        }
        case liquid_html_parser_1.NodeTypes.TextNode:
            return constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT;
        case liquid_html_parser_1.NodeTypes.RawMarkup:
        case liquid_html_parser_1.NodeTypes.YAMLFrontmatter:
        case liquid_html_parser_1.NodeTypes.LiquidRawTag:
            return 'pre';
        case liquid_html_parser_1.NodeTypes.LiquidTag:
            switch (node.name) {
                case 'capture': {
                    switch (options.captureWhitespaceSensitivity) {
                        case 'strict':
                            return 'pre';
                        case 'ignore':
                            return 'normal';
                        default: {
                            throw (0, utils_1.assertNever)(options.captureWhitespaceSensitivity);
                        }
                    }
                }
                default: {
                    return constants_evaluate_1.CSS_WHITE_SPACE_LIQUID_TAGS[node.name] || constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT;
                }
            }
        case liquid_html_parser_1.NodeTypes.LiquidBranch:
        case liquid_html_parser_1.NodeTypes.LiquidVariableOutput:
            return constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT;
        case liquid_html_parser_1.NodeTypes.AttrDoubleQuoted:
        case liquid_html_parser_1.NodeTypes.AttrSingleQuoted:
        case liquid_html_parser_1.NodeTypes.AttrUnquoted:
        case liquid_html_parser_1.NodeTypes.AttrEmpty:
            return constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT;
        case liquid_html_parser_1.NodeTypes.HtmlDoctype:
        case liquid_html_parser_1.NodeTypes.HtmlComment:
            return constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT;
        case liquid_html_parser_1.NodeTypes.Document:
            return constants_evaluate_1.CSS_WHITE_SPACE_DEFAULT;
        case liquid_html_parser_1.NodeTypes.LiquidVariable:
        case liquid_html_parser_1.NodeTypes.LiquidFilter:
        case liquid_html_parser_1.NodeTypes.NamedArgument:
        case liquid_html_parser_1.NodeTypes.LiquidLiteral:
        case liquid_html_parser_1.NodeTypes.BooleanExpression:
        case liquid_html_parser_1.NodeTypes.String:
        case liquid_html_parser_1.NodeTypes.Number:
        case liquid_html_parser_1.NodeTypes.Range:
        case liquid_html_parser_1.NodeTypes.VariableLookup:
        case liquid_html_parser_1.NodeTypes.AssignMarkup:
        case liquid_html_parser_1.NodeTypes.CycleMarkup:
        case liquid_html_parser_1.NodeTypes.ContentForMarkup:
        case liquid_html_parser_1.NodeTypes.ForMarkup:
        case liquid_html_parser_1.NodeTypes.PaginateMarkup:
        case liquid_html_parser_1.NodeTypes.RenderMarkup:
        case liquid_html_parser_1.NodeTypes.RenderVariableExpression:
        case liquid_html_parser_1.NodeTypes.RenderAliasExpression:
        case liquid_html_parser_1.NodeTypes.LogicalExpression:
        case liquid_html_parser_1.NodeTypes.Comparison:
        case liquid_html_parser_1.NodeTypes.LiquidDocParamNode:
        case liquid_html_parser_1.NodeTypes.LiquidDocExampleNode:
        case liquid_html_parser_1.NodeTypes.LiquidDocDescriptionNode:
        case liquid_html_parser_1.NodeTypes.LiquidDocPromptNode:
            return 'should not be relevant';
        default:
            return (0, utils_1.assertNever)(node);
    }
}
const augmentWithCSSProperties = (options, node) => {
    const augmentations = {
        cssDisplay: getCssDisplay(node, options),
        cssWhitespace: getNodeCssStyleWhiteSpace(node, options),
    };
    Object.assign(node, augmentations);
};
exports.augmentWithCSSProperties = augmentWithCSSProperties;
//# sourceMappingURL=augment-with-css-properties.js.map