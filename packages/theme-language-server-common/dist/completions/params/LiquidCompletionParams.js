"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLiquidCompletionParams = createLiquidCompletionParams;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const fix_1 = require("./fix");
function createLiquidCompletionParams(sourceCode, params) {
    const { textDocument } = sourceCode;
    const cursor = textDocument.offsetAt(params.position);
    const completionContext = getCompletionContext(sourceCode, cursor);
    return {
        ...params,
        completionContext,
        document: sourceCode,
    };
}
function getCompletionContext(sourceCode, cursor) {
    const partialAst = parsePartial(sourceCode, cursor);
    if (!partialAst) {
        return undefined;
    }
    const [node, ancestors] = findCurrentNode(partialAst, cursor);
    return {
        partialAst,
        ancestors,
        node,
    };
}
/**
 * This function will return an AST of the entire file up until the cursor
 * position.
 *
 * So if you accept that we use █ to represent the cursor, and a have a file that
 * looks like this:
 *
 * <div>
 *   {% assign x = product %}
 *   {% assign y = x | plus: 20 %}
 *   {% assign z = █ %}
 *   <span>
 *     this content is not part of the partial tree
 *   </span>
 * </div>
 *
 * Then the contents of the file up until the cursor position is this:
 *
 * <div>
 *   {% assign x = product %}
 *   {% assign y = x | plus: 20 %}
 *   {% assign z = █
 *
 * Then we'll use `fix(sourceCode, cursorPosition)` to make it parseable.
 * Fixed output:
 *
 * <div>
 *   {% assign x = product %}
 *   {% assign y = x | plus: 20 %}
 *   {% assign z = █%}
 *
 * Then we'll parse this with `allowUnclosedDocumentNode` and
 * `mode: completion` to allow parsing of placeholder characters (█)
 *
 * The result is a partial AST whose last-most node is probably the one
 * under the cursor.
 */
function parsePartial(sourceCode, cursorPosition) {
    let fixedSource;
    try {
        fixedSource = (0, fix_1.fix)(sourceCode.source, cursorPosition);
        const ast = (0, liquid_html_parser_1.toLiquidHtmlAST)(fixedSource, {
            allowUnclosedDocumentNode: true,
            mode: 'completion',
        });
        ast._source = sourceCode.source;
        return ast;
    }
    catch (err) {
        // We swallow errors here, because we gracefully accept that and
        // simply don't offer completions when that happens.
        return undefined;
    }
}
class Finder {
    constructor(ast) {
        this.stack = [ast];
    }
    get current() {
        return last(this.stack);
    }
    get parent() {
        return this.stack.at(-2);
    }
    set current(node) {
        this.stack.push(node);
    }
}
/**
 * @returns the node at the cursor position and its ancestry.
 *
 * Undefined when you're not really on a node (there's nothing to complete)
 */
function findCurrentNode(partialAst, cursor) {
    // The current node is the "last" node in the AST.
    const finder = new Finder(partialAst);
    let current = { ...partialAst };
    // Our objective:
    //   Finding the "last-most node" in the partial AST.
    //
    // Context:
    //   A generic visitor doesn't quite work in this context because we
    //   cannot trust the position, blockStartPosition, blockEndPosition of
    //   nodes when we use `allowUnclosedDocumentNode`. You see, these
    //   properties are updated when the nodes are closed. An {% if cond %}
    //   node without its closing {% endif %} would have its position.end be
    //   the one of the starting block. Which means that any children it may
    //   have wouldn't be covered.
    //
    // How we do it:
    //   We define logic per node type. For example, HTML tags will do this:
    //     - If the node is closed (<a>child</a>),
    //         then there's nothing to complete.
    //         We return undefined
    //     - If the node has children,
    //         then we visit the last children
    //     - If the node has attributes,
    //         then we visit the last attribute
    //     - If the node has a name,
    //         then we visit the last name node (<a--{{ product.id }}>)
    //
    //   It's different per node type, because each node type has a different
    //   concept of child node and because they have to be traversed in a
    //   specific order.
    while (finder.current !== undefined && current !== finder.current) {
        current = finder.current;
        switch (current.type) {
            case liquid_html_parser_1.NodeTypes.Document: {
                if (hasNonEmptyArrayProperty(current, 'children')) {
                    finder.current = last(current.children);
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.HtmlRawNode:
            case liquid_html_parser_1.NodeTypes.HtmlVoidElement:
            case liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose:
            case liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement:
            case liquid_html_parser_1.NodeTypes.HtmlElement: {
                if (isCompletedTag(current)) {
                    finder.current = undefined;
                }
                else if (hasNonEmptyArrayProperty(current, 'children')) {
                    finder.current = last(current.children);
                }
                else if (hasNonEmptyArrayProperty(current, 'attributes')) {
                    finder.current = last(current.attributes);
                }
                else if (hasNonEmptyArrayProperty(current, 'name') &&
                    isCoveredExcluded(cursor, current.blockStartPosition)) {
                    finder.current = last(current.name);
                }
                else if (typeof current.name === 'string' &&
                    isCoveredExcluded(cursor, current.blockStartPosition)) {
                    /* break */
                }
                else {
                    finder.current = undefined; // there's nothing to complete
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.LiquidTag: {
                if (isLiquidLiquidTag(finder.current) ||
                    isCoveredExcluded(cursor, current.blockStartPosition) || // wouldn't want to complete {% if cond %} after the }.
                    (isInLiquidLiquidTagContext(finder) && isCovered(cursor, current.blockStartPosition))) {
                    if (hasNonNullProperty(current, 'markup') && typeof current.markup !== 'string') {
                        finder.current = Array.isArray(current.markup) ? current.markup.at(-1) : current.markup;
                    }
                    else {
                        // Exits the loop and the node is the thing to complete
                        // (presumably name or something else)
                        // finder.current = finder.current;
                    }
                }
                else if (isIncompleteBlockTag(current)) {
                    finder.current = last(current.children);
                }
                else {
                    finder.current = undefined; // we're done and there's nothing to complete
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.LiquidBranch:
                if (isCovered(cursor, current.blockStartPosition) && typeof current.markup !== 'string') {
                    finder.current = Array.isArray(current.markup) ? current.markup.at(-1) : current.markup;
                }
                else if (hasNonEmptyArrayProperty(current, 'children')) {
                    finder.current = last(current.children);
                }
                else {
                    finder.current = undefined; // there's nothing to complete
                }
                break;
            case liquid_html_parser_1.NodeTypes.LiquidRawTag:
                if (current.name === 'doc' && current.body.nodes.length > 0) {
                    finder.current = current.body.nodes.at(-1);
                }
                break;
            case liquid_html_parser_1.NodeTypes.AttrDoubleQuoted:
            case liquid_html_parser_1.NodeTypes.AttrSingleQuoted:
            case liquid_html_parser_1.NodeTypes.AttrEmpty:
            case liquid_html_parser_1.NodeTypes.AttrUnquoted: {
                const lastNameNode = last(current.name); // there's at least one... guaranteed.
                if (isCovered(cursor, lastNameNode.position)) {
                    finder.current = lastNameNode;
                }
                else if (current.type !== liquid_html_parser_1.NodeTypes.AttrEmpty &&
                    isCovered(cursor, current.attributePosition) &&
                    isNotEmpty(current.value)) {
                    finder.current = last(current.value);
                }
                else {
                    finder.current = undefined;
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.YAMLFrontmatter:
            case liquid_html_parser_1.NodeTypes.HtmlDoctype:
            case liquid_html_parser_1.NodeTypes.HtmlComment:
            case liquid_html_parser_1.NodeTypes.RawMarkup: {
                break;
            }
            case liquid_html_parser_1.NodeTypes.LiquidVariableOutput: {
                if (typeof current.markup !== 'string') {
                    finder.current = current.markup;
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.LiquidVariable: {
                if (isNotEmpty(current.filters)) {
                    finder.current = last(current.filters);
                }
                else {
                    finder.current = current.expression;
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.LiquidFilter: {
                if (isNotEmpty(current.args)) {
                    finder.current = last(current.args);
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.VariableLookup: {
                if (hasNonEmptyArrayProperty(current, 'lookups') &&
                    last(current.lookups).type === liquid_html_parser_1.NodeTypes.VariableLookup) {
                    finder.current = last(current.lookups);
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.AssignMarkup: {
                finder.current = current.value;
                break;
            }
            case liquid_html_parser_1.NodeTypes.ForMarkup: {
                if (isCovered(cursor, current.collection.position)) {
                    finder.current = current.collection;
                }
                else if (isNotEmpty(current.args) && isCovered(cursor, last(current.args).position)) {
                    finder.current = last(current.args);
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.NamedArgument: {
                if (isCovered(cursor, current.value.position)) {
                    finder.current = current.value;
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.Comparison: {
                finder.current = current.right;
                break;
            }
            case liquid_html_parser_1.NodeTypes.LogicalExpression: {
                finder.current = current.right;
                break;
            }
            case liquid_html_parser_1.NodeTypes.CycleMarkup: {
                if (isNotEmpty(current.args)) {
                    finder.current = last(current.args);
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.PaginateMarkup: {
                if (isNotEmpty(current.args)) {
                    finder.current = last(current.args);
                }
                else if (isCovered(cursor, current.collection.position)) {
                    finder.current = current.collection;
                }
                else if (isCovered(cursor, current.pageSize.position)) {
                    finder.current = current.pageSize;
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.ContentForMarkup: {
                if (isNotEmpty(current.args)) {
                    finder.current = last(current.args);
                }
                else if (isCovered(cursor, current.contentForType.position)) {
                    finder.current = current.contentForType;
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.RenderMarkup: {
                if (isNotEmpty(current.args)) {
                    finder.current = last(current.args);
                }
                else if (current.variable && isCovered(cursor, current.variable.position)) {
                    finder.current = current.variable;
                }
                else if (current.snippet && isCovered(cursor, current.snippet.position)) {
                    finder.current = current.snippet;
                }
                break;
            }
            case liquid_html_parser_1.NodeTypes.RenderVariableExpression: {
                finder.current = current.name;
                break;
            }
            case liquid_html_parser_1.NodeTypes.Range: {
                // This means you can't complete the start range as a variable...
                // is this bad?
                finder.current = current.end;
                break;
            }
            // If you end up on any of these. You're done.
            // That's the current node.
            case liquid_html_parser_1.NodeTypes.TextNode:
            case liquid_html_parser_1.NodeTypes.LiquidLiteral:
            case liquid_html_parser_1.NodeTypes.BooleanExpression:
            case liquid_html_parser_1.NodeTypes.String:
            case liquid_html_parser_1.NodeTypes.Number:
            case liquid_html_parser_1.NodeTypes.LiquidDocParamNode:
            case liquid_html_parser_1.NodeTypes.LiquidDocExampleNode:
            case liquid_html_parser_1.NodeTypes.LiquidDocDescriptionNode:
            case liquid_html_parser_1.NodeTypes.LiquidDocPromptNode:
            case liquid_html_parser_1.NodeTypes.RenderAliasExpression: {
                break;
            }
            default: {
                return assertNever(current);
            }
        }
    }
    return [finder.stack.pop(), finder.stack];
}
function hasNonNullProperty(thing, property) {
    return thing !== null && property in thing && !!thing[property];
}
function isIncompleteBlockTag(thing) {
    return (hasNonEmptyArrayProperty(thing, 'children') &&
        (!hasNonNullProperty(thing, 'blockEndPosition') ||
            (thing.blockEndPosition.start === -1 && thing.blockEndPosition.end === -1)));
}
function isCompletedTag(thing) {
    return (hasNonNullProperty(thing, 'blockEndPosition') &&
        thing.blockEndPosition.start !== -1 &&
        thing.blockEndPosition.end !== -1);
}
function hasNonEmptyArrayProperty(thing, property) {
    return (thing !== null &&
        property in thing &&
        Array.isArray(thing[property]) &&
        !isEmpty(thing[property]));
}
function isInLiquidLiquidTagContext(finder) {
    return finder.stack.some(isLiquidLiquidTag);
}
function isLiquidLiquidTag(node) {
    if (!node)
        return false;
    return node.type === liquid_html_parser_1.NodeTypes.LiquidTag && node.name === 'liquid';
}
function isCoveredExcluded(cursor, position) {
    return position.start <= cursor && cursor < position.end;
}
function isCovered(cursor, position) {
    return position.start <= cursor && cursor <= position.end;
}
function isNotEmpty(x) {
    return x.length > 0;
}
function isEmpty(x) {
    return x.length === 0;
}
function last(x) {
    return x[x.length - 1];
}
function assertNever(x) {
    throw new Error(`This function should never be called, but was called with ${x}`);
}
//# sourceMappingURL=LiquidCompletionParams.js.map