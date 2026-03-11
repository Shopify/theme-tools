"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printerLiquidHtml3 = exports.printerLiquidHtml2 = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const prettier_1 = require("prettier");
const types_1 = require("../types");
const utils_1 = require("../utils");
const embed_1 = require("./embed");
const print_preprocess_1 = require("./print-preprocess");
const children_1 = require("./print/children");
const element_1 = require("./print/element");
const liquid_1 = require("./print/liquid");
const tag_1 = require("./print/tag");
const utils_2 = require("./utils");
const { builders, utils } = prettier_1.doc;
const { fill, group, hardline, dedentToRoot, indent, join, line, softline } = builders;
const oppositeQuotes = {
    '"': "'",
    "'": '"',
};
function printAttributeName(path, _options, print) {
    const node = path.getValue();
    node.name;
    return join('', path.map((part) => {
        const value = part.getValue();
        if (typeof value === 'string') {
            return value;
        }
        else {
            // We want to force the LiquidVariableOutput to be on one line to avoid weird
            // shenanigans
            return utils.removeLines(print(part));
        }
    }, 'name'));
}
function printAttribute(path, options, print) {
    const node = path.getValue();
    const attrGroupId = Symbol('attr-group-id');
    // What should be the rule here? Should it really be "paragraph"?
    // ideally... if the thing is and the line is too long
    // use cases:
    //  - attr-{{ section.id }}--something.
    //  * We should try to put that "block" on one line
    //
    //  - attr {{ classname }} foo
    //  * we should try to put on one line?
    //
    //  - attr hello world ok fellow friends what do
    //  * if the line becomes too long do we want to break one per line?
    //    - for alt, would be paragraph
    //    - for classes, yeah maybe
    //    - for srcset?, it should be "split on comma"
    //    - for sizes?, it should be "split on comma"
    //    - for href?, it should be no space url
    //    - for others?, it should be keywords
    //    - for style, should be break on ;
    //    - for other?, should be...
    //    - how the fuck am I going to do that?
    //    - same way we do this? with a big ass switch case?
    //    - or we... don't and leave it as is?
    //
    // Anyway, for that reason ^, for now I'll just paste in what we have in
    // the source. It's too hard to get right.
    const value = node.source.slice(node.attributePosition.start, node.attributePosition.end);
    const preferredQuote = options.singleQuote ? `'` : `"`;
    const attributeValueContainsQuote = !!node.value.find((valueNode) => (0, utils_2.isTextLikeNode)(valueNode) && valueNode.value.includes(preferredQuote));
    const quote = attributeValueContainsQuote ? oppositeQuotes[preferredQuote] : preferredQuote;
    return [
        printAttributeName(path, options, print),
        '=',
        quote,
        (0, utils_2.hasLineBreakInRange)(node.source, node.attributePosition.start, node.attributePosition.end)
            ? group([indent([softline, join(hardline, (0, utils_2.reindent)((0, utils_2.bodyLines)(value), true))]), softline], {
                id: attrGroupId,
            })
            : value,
        quote,
    ];
}
function isYamlFrontMatter(node) {
    return (node.parentNode &&
        node.parentNode.type === liquid_html_parser_1.NodeTypes.Document &&
        !node.prev &&
        /^---\r?\n/.test(node.value));
}
function printTextNode(path, options, _print) {
    const node = path.getValue();
    if (isYamlFrontMatter(node))
        return node.value;
    if (node.value.match(/^\s*$/))
        return '';
    const text = node.value;
    const paragraphs = text
        .split(/(\r?\n){2,}/)
        .filter(Boolean) // removes empty paragraphs (trailingWhitespace)
        .map((curr) => {
        let doc = [];
        const words = curr.trim().split(/\s+/g);
        let isFirst = true;
        for (let j = 0; j < words.length; j++) {
            const word = words[j];
            if (isFirst) {
                isFirst = false;
            }
            else {
                doc.push(line);
            }
            doc.push(word);
        }
        return fill(doc);
    });
    return [
        (0, tag_1.printOpeningTagPrefix)(node, options),
        join(hardline, paragraphs),
        (0, tag_1.printClosingTagSuffix)(node, options),
    ];
}
function printNode(path, options, print, args = {}) {
    const node = path.getValue();
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.Document: {
            return [(0, children_1.printChildren)(path, options, print, args), hardline];
        }
        case liquid_html_parser_1.NodeTypes.HtmlElement: {
            return (0, element_1.printElement)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose: {
            return (0, element_1.printElement)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.HtmlVoidElement: {
            return (0, element_1.printElement)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement: {
            return (0, element_1.printElement)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.HtmlRawNode: {
            return (0, element_1.printElement)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.RawMarkup: {
            if (node.parentNode?.name === 'doc') {
                return (0, liquid_1.printLiquidDoc)(path, options, print, args);
            }
            const isRawMarkupIdentationSensitive = () => {
                switch (node.kind) {
                    case liquid_html_parser_1.RawMarkupKinds.typescript:
                    case liquid_html_parser_1.RawMarkupKinds.javascript: {
                        return node.value.includes('`');
                    }
                    default: {
                        return false;
                    }
                }
            };
            if (isRawMarkupIdentationSensitive()) {
                return [node.value.trimEnd(), hardline];
            }
            const parentNode = node.parentNode;
            const shouldNotIndentBody = parentNode &&
                parentNode.type === liquid_html_parser_1.NodeTypes.LiquidRawTag &&
                parentNode.name === 'schema' &&
                !options.indentSchema;
            const shouldIndentBody = node.kind !== liquid_html_parser_1.RawMarkupKinds.markdown && !shouldNotIndentBody;
            const lines = (0, utils_2.bodyLines)(node.value);
            const rawFirstLineIsntIndented = !!node.value.split(/\r?\n/)[0]?.match(/\S/);
            const shouldSkipFirstLine = rawFirstLineIsntIndented;
            const body = lines.length > 0 && lines.find((line) => line.trim() !== '')
                ? join(hardline, (0, utils_2.reindent)(lines, shouldSkipFirstLine))
                : softline;
            if (shouldIndentBody) {
                return [indent([hardline, body]), hardline];
            }
            else {
                return [dedentToRoot([hardline, body]), hardline];
            }
        }
        case liquid_html_parser_1.NodeTypes.LiquidVariableOutput: {
            return (0, liquid_1.printLiquidVariableOutput)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.LiquidRawTag: {
            return (0, liquid_1.printLiquidRawTag)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.LiquidTag: {
            return (0, liquid_1.printLiquidTag)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.LiquidBranch: {
            return (0, liquid_1.printLiquidBranch)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.AttrEmpty: {
            return printAttributeName(path, options, print);
        }
        case liquid_html_parser_1.NodeTypes.AttrUnquoted:
        case liquid_html_parser_1.NodeTypes.AttrSingleQuoted:
        case liquid_html_parser_1.NodeTypes.AttrDoubleQuoted: {
            return printAttribute(path, options, print);
        }
        case liquid_html_parser_1.NodeTypes.HtmlDoctype: {
            if (!node.legacyDoctypeString)
                return '<!doctype html>';
            return node.source.slice(node.position.start, node.position.end);
        }
        case liquid_html_parser_1.NodeTypes.HtmlComment: {
            const conditionalComment = (0, liquid_html_parser_1.getConditionalComment)(node.source.slice(node.position.start, node.position.end));
            if (conditionalComment) {
                const { startTag, body, endTag } = conditionalComment;
                return [
                    startTag,
                    group([indent([line, join(hardline, (0, utils_2.reindent)((0, utils_2.bodyLines)(body), true))]), line]),
                    endTag,
                ];
            }
            if (node.body.includes('prettier-ignore') ||
                node.body.startsWith('display:') ||
                node.body.startsWith('white-space:')) {
                return node.source.slice(node.position.start, node.position.end);
            }
            return [
                '<!--',
                group([indent([line, join(hardline, (0, utils_2.reindent)((0, utils_2.bodyLines)(node.body), true))]), line]),
                '-->',
            ];
        }
        case liquid_html_parser_1.NodeTypes.AssignMarkup: {
            return [node.name, ' = ', path.call((p) => print(p), 'value')];
        }
        case liquid_html_parser_1.NodeTypes.CycleMarkup: {
            const doc = [];
            if (node.groupName) {
                doc.push(path.call((p) => print(p), 'groupName'), ':');
            }
            const whitespace = node.args.length > 1 ? line : ' ';
            doc.push(whitespace, join([',', whitespace], path.map((p) => print(p), 'args')));
            return doc;
        }
        case liquid_html_parser_1.NodeTypes.ForMarkup: {
            const doc = [node.variableName, ' in ', path.call((p) => print(p), 'collection')];
            if (node.reversed) {
                doc.push(line, 'reversed');
            }
            if (node.args.length > 0) {
                doc.push([
                    line,
                    join(line, path.map((p) => print(p), 'args')),
                ]);
            }
            return doc;
        }
        case liquid_html_parser_1.NodeTypes.PaginateMarkup: {
            const doc = [
                path.call((p) => print(p), 'collection'),
                line,
                'by ',
                path.call((p) => print(p), 'pageSize'),
            ];
            if (node.args.length > 0) {
                doc.push([
                    ',',
                    line,
                    join([',', line], path.map((p) => print(p), 'args')),
                ]);
            }
            return doc;
        }
        case liquid_html_parser_1.NodeTypes.ContentForMarkup: {
            const contentForType = path.call((p) => print(p), 'contentForType');
            const doc = [contentForType];
            if (node.args.length > 0) {
                doc.push(',', line, join([',', line], path.map((p) => print(p), 'args')));
            }
            return doc;
        }
        case liquid_html_parser_1.NodeTypes.RenderMarkup: {
            const snippet = path.call((p) => print(p), 'snippet');
            const doc = [snippet];
            if (node.variable) {
                const whitespace = node.alias?.value ? line : ' ';
                doc.push(whitespace, path.call((p) => print(p), 'variable'));
            }
            if (node.alias?.value) {
                doc.push(' ', 'as', ' ', node.alias.value);
            }
            if (node.args.length > 0) {
                doc.push(',', line, join([',', line], path.map((p) => print(p), 'args')));
            }
            return doc;
        }
        case liquid_html_parser_1.NodeTypes.RenderVariableExpression: {
            return [node.kind, ' ', path.call((p) => print(p), 'name')];
        }
        case liquid_html_parser_1.NodeTypes.RenderAliasExpression: {
            return node.value;
        }
        case liquid_html_parser_1.NodeTypes.LogicalExpression: {
            return [
                path.call((p) => print(p), 'left'),
                line,
                node.relation,
                ' ',
                path.call((p) => print(p), 'right'),
            ];
        }
        case liquid_html_parser_1.NodeTypes.Comparison: {
            return group([
                path.call((p) => print(p), 'left'),
                indent([line, node.comparator, ' ', path.call((p) => print(p), 'right')]),
            ]);
        }
        case liquid_html_parser_1.NodeTypes.LiquidVariable: {
            const name = path.call((p) => print(p), 'expression');
            let filters = '';
            if (node.filters.length > 0) {
                filters = [
                    line,
                    join(line, path.map((p) => print(p), 'filters')),
                ];
            }
            return [name, filters];
        }
        case liquid_html_parser_1.NodeTypes.LiquidFilter: {
            let args = [];
            if (node.args.length > 0) {
                const printed = path.map((p) => print(p), 'args');
                const shouldPrintFirstArgumentSameLine = node.args[0].type !== liquid_html_parser_1.NodeTypes.NamedArgument;
                if (shouldPrintFirstArgumentSameLine) {
                    const [firstDoc, ...rest] = printed;
                    const restDoc = (0, utils_2.isEmpty)(rest) ? '' : indent([',', line, join([',', line], rest)]);
                    args = [': ', firstDoc, restDoc];
                }
                else {
                    args = [':', indent([line, join([',', line], printed)])];
                }
            }
            return group(['| ', node.name, ...args]);
        }
        case liquid_html_parser_1.NodeTypes.NamedArgument: {
            return [node.name, ': ', path.call((p) => print(p), 'value')];
        }
        case liquid_html_parser_1.NodeTypes.TextNode: {
            return printTextNode(path, options, print);
        }
        case liquid_html_parser_1.NodeTypes.YAMLFrontmatter: {
            return ['---', hardline, node.body, '---'];
        }
        case liquid_html_parser_1.NodeTypes.BooleanExpression: {
            return path.call((p) => print(p), 'condition');
        }
        case liquid_html_parser_1.NodeTypes.String: {
            const preferredQuote = options.liquidSingleQuote ? `'` : `"`;
            const valueHasQuotes = node.value.includes(preferredQuote);
            const quote = valueHasQuotes ? oppositeQuotes[preferredQuote] : preferredQuote;
            return [quote, node.value, quote];
        }
        case liquid_html_parser_1.NodeTypes.Number: {
            if (args.truncate) {
                return node.value.replace(/\.\d+$/, '');
            }
            else {
                return node.value;
            }
        }
        case liquid_html_parser_1.NodeTypes.Range: {
            return [
                '(',
                path.call((p) => print(p, { truncate: true }), 'start'),
                '..',
                path.call((p) => print(p, { truncate: true }), 'end'),
                ')',
            ];
        }
        case liquid_html_parser_1.NodeTypes.LiquidLiteral: {
            // We prefer null over nil.
            if (node.keyword === 'nil') {
                return 'null';
            }
            return node.keyword;
        }
        case liquid_html_parser_1.NodeTypes.VariableLookup: {
            const doc = [];
            if (node.name) {
                doc.push(node.name);
            }
            const lookups = path.map((lookupPath, index) => {
                const lookup = lookupPath.getValue();
                switch (lookup.type) {
                    case liquid_html_parser_1.NodeTypes.String: {
                        const value = lookup.value;
                        // We prefer direct access
                        // (for everything but stuff with dashes and stuff that starts with a number)
                        const isGlobalStringLookup = index === 0 && !node.name;
                        if (!isGlobalStringLookup && /^\D/.test(value) && /^[a-z0-9_]+\??$/i.test(value)) {
                            return ['.', value];
                        }
                        return ['[', print(lookupPath), ']'];
                    }
                    default: {
                        return ['[', print(lookupPath), ']'];
                    }
                }
            }, 'lookups');
            return [...doc, ...lookups];
        }
        case liquid_html_parser_1.NodeTypes.LiquidDocParamNode: {
            return (0, liquid_1.printLiquidDocParam)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.LiquidDocExampleNode: {
            return (0, liquid_1.printLiquidDocExample)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.LiquidDocDescriptionNode: {
            return (0, liquid_1.printLiquidDocDescription)(path, options, print, args);
        }
        case liquid_html_parser_1.NodeTypes.LiquidDocPromptNode: {
            return (0, liquid_1.printLiquidDocPrompt)(path, options, print, args);
        }
        default: {
            return (0, utils_1.assertNever)(node);
        }
    }
}
exports.printerLiquidHtml2 = {
    print: printNode,
    embed: embed_1.embed2,
    preprocess: print_preprocess_1.preprocess,
    getVisitorKeys(node, nonTraversableKeys) {
        return Object.keys(node).filter((key) => !nonTraversableKeys.has(key) &&
            !types_1.nonTraversableProperties.has(key) &&
            hasOrIsNode(node, key));
    },
};
exports.printerLiquidHtml3 = {
    print: printNode,
    embed: embed_1.embed3,
    preprocess: print_preprocess_1.preprocess,
    getVisitorKeys(node, nonTraversableKeys) {
        return Object.keys(node).filter((key) => !nonTraversableKeys.has(key) &&
            !types_1.nonTraversableProperties.has(key) &&
            hasOrIsNode(node, key));
    },
};
function hasOrIsNode(node, key) {
    const v = node[key];
    // this works because there's no ()[] type that is string | Node, it only
    // happens for singular nodes such as name: string | LiquidDrop, etc.
    // Note: isNode logic inlined to avoid terser const reassignment in standalone build
    return (Array.isArray(v) ||
        (v !== null && typeof v === 'object' && 'type' in v && typeof v.type === 'string'));
}
//# sourceMappingURL=printer-liquid-html.js.map