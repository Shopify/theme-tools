"use strict";
/**
 * This is the second stage of the parser.
 *
 * Input:
 *  - A Concrete Syntax Tree (CST)
 *
 * Output:
 *  - An Abstract Syntax Tree (AST)
 *
 * This stage traverses the flat tree we get from the previous stage and
 * establishes the parent/child relationship between the nodes.
 *
 * Recall the Liquid example we had in the first stage:
 *   {% if cond %}hi <em>there!</em>{% endif %}
 *
 * Whereas the previous stage gives us this CST:
 *   - LiquidTagOpen/if
 *     condition: LiquidVariableExpression/cond
 *   - TextNode/"hi "
 *   - HtmlTagOpen/em
 *   - TextNode/"there!"
 *   - HtmlTagClose/em
 *   - LiquidTagClose/if
 *
 * We now traverse all the nodes and turn that into a proper AST:
 *   - LiquidTag/if
 *     condition: LiquidVariableExpression
 *     children:
 *       - TextNode/"hi "
 *       - HtmlElement/em
 *         children:
 *           - TextNode/"there!"
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawMarkupKinds = void 0;
exports.isBranchedTag = isBranchedTag;
exports.toLiquidAST = toLiquidAST;
exports.toLiquidHtmlAST = toLiquidHtmlAST;
exports.getName = getName;
exports.cstToAst = cstToAst;
exports.walk = walk;
exports.isLiquidHtmlNode = isLiquidHtmlNode;
const stage_1_cst_1 = require("./stage-1-cst");
const types_1 = require("./types");
const utils_1 = require("./utils");
const errors_1 = require("./errors");
const grammar_1 = require("./grammar");
const stage_1_cst_2 = require("./stage-1-cst");
/**
 * The infered kind of raw markup
 * - `<script>` is javascript
 * - `<script type="application/json">` is JSON
 * - `<style>` is css
 * - etc.
 */
var RawMarkupKinds;
(function (RawMarkupKinds) {
    RawMarkupKinds["css"] = "css";
    RawMarkupKinds["html"] = "html";
    RawMarkupKinds["javascript"] = "javascript";
    RawMarkupKinds["json"] = "json";
    RawMarkupKinds["markdown"] = "markdown";
    RawMarkupKinds["typescript"] = "typescript";
    RawMarkupKinds["text"] = "text";
})(RawMarkupKinds || (exports.RawMarkupKinds = RawMarkupKinds = {}));
function isBranchedTag(node) {
    return node.type === types_1.NodeTypes.LiquidTag && ['if', 'for', 'unless', 'case'].includes(node.name);
}
function isConcreteLiquidBranchDisguisedAsTag(node) {
    return node.type === stage_1_cst_1.ConcreteNodeTypes.LiquidTag && ['else', 'elsif', 'when'].includes(node.name);
}
function toLiquidAST(source, options = {
    allowUnclosedDocumentNode: true,
    mode: 'tolerant',
}) {
    const cst = (0, stage_1_cst_2.toLiquidCST)(source, { mode: options.mode });
    const root = {
        type: types_1.NodeTypes.Document,
        source: source,
        _source: source, // this can get replaced somewhere else...
        children: cstToAst(cst, options),
        name: '#document',
        position: {
            start: 0,
            end: source.length,
        },
    };
    return root;
}
function toLiquidHtmlAST(source, options = {
    allowUnclosedDocumentNode: false,
    mode: 'tolerant',
}) {
    const cst = (0, stage_1_cst_1.toLiquidHtmlCST)(source, { mode: options.mode });
    const root = {
        type: types_1.NodeTypes.Document,
        source: source,
        _source: source,
        children: cstToAst(cst, options),
        name: '#document',
        position: {
            start: 0,
            end: source.length,
        },
    };
    return root;
}
class ASTBuilder {
    constructor(source) {
        this.ast = [];
        this.cursor = [];
        this.source = source;
    }
    // Returns the array to push nodes to.
    get current() {
        return (0, utils_1.deepGet)(this.cursor, this.ast);
    }
    // Returns the position of the current node in the array
    get currentPosition() {
        return (this.current || []).length - 1;
    }
    get parent() {
        if (this.cursor.length == 0)
            return undefined;
        return (0, utils_1.deepGet)((0, utils_1.dropLast)(1, this.cursor), this.ast);
    }
    get grandparent() {
        if (this.cursor.length < 4)
            return undefined;
        return (0, utils_1.deepGet)((0, utils_1.dropLast)(3, this.cursor), this.ast);
    }
    open(node) {
        this.current.push(node);
        this.cursor.push(this.currentPosition);
        this.cursor.push('children');
        if (isBranchedTag(node)) {
            this.open(toUnnamedLiquidBranch(node));
        }
    }
    push(node) {
        if (node.type === types_1.NodeTypes.LiquidBranch) {
            const previousBranch = this.findCloseableParentBranch(node);
            if (previousBranch) {
                previousBranch.blockEndPosition = { start: node.position.start, end: node.position.start };
                // close dangling open HTML nodes
                while (this.parent &&
                    this.parent !== previousBranch &&
                    this.parent.type === types_1.NodeTypes.HtmlElement) {
                    // 0-length blockEndPosition at the position of the next branch
                    this.parent.blockEndPosition = { start: node.position.start, end: node.position.start };
                    this.closeParentWith(node);
                }
                // close the previous branch
                this.closeParentWith(node);
            }
            this.open(node);
        }
        else {
            this.current.push(node);
        }
    }
    close(node, nodeType) {
        var _a, _b;
        if (isLiquidBranch(this.parent)) {
            this.parent.blockEndPosition = { start: node.locStart, end: node.locStart };
            this.closeParentWith(node);
        }
        if (!this.parent) {
            throw new errors_1.LiquidHTMLASTParsingError(`Attempting to close ${nodeType} '${getName(node)}' before it was opened`, this.source, node.locStart, node.locEnd);
        }
        if (getName(this.parent) !== getName(node) || this.parent.type !== nodeType) {
            const suitableParent = this.findCloseableParentNode(node);
            if (this.parent.type === types_1.NodeTypes.HtmlElement && suitableParent) {
                // close dangling open HTML nodes
                while (this.parent !== suitableParent) {
                    // 0-length end block position
                    this.parent.blockEndPosition = { start: node.locStart, end: node.locStart };
                    this.closeParentWith(node);
                }
            }
            else {
                throw new errors_1.LiquidHTMLASTParsingError(`Attempting to close ${nodeType} '${getName(node)}' before ${this.parent.type} '${getName(this.parent)}' was closed`, this.source, this.parent.position.start, node.locEnd, getUnclosed(this.parent));
            }
        }
        // The parent end is the end of the outer tag.
        this.parent.position.end = node.locEnd;
        this.parent.blockEndPosition = position(node);
        if (this.parent.type == types_1.NodeTypes.LiquidTag && node.type == stage_1_cst_1.ConcreteNodeTypes.LiquidTagClose) {
            this.parent.delimiterWhitespaceStart = (_a = node.whitespaceStart) !== null && _a !== void 0 ? _a : '';
            this.parent.delimiterWhitespaceEnd = (_b = node.whitespaceEnd) !== null && _b !== void 0 ? _b : '';
        }
        this.cursor.pop();
        this.cursor.pop();
    }
    // This function performs the following tasks:
    // - Tries to find a parent branch to close when pushing a new branch.
    // - This is necessary because we allow unclosed HTML element nodes.
    // - The function traverses up the tree until it finds a LiquidBranch.
    // - If it encounters anything other than an Unclosed HTML Element, it throws.
    findCloseableParentBranch(next) {
        for (let index = this.cursor.length - 1; index > 0; index -= 2) {
            const parent = (0, utils_1.deepGet)(this.cursor.slice(0, index), this.ast);
            const parentProperty = this.cursor[index];
            const isUnclosedHtmlElement = parent.type === types_1.NodeTypes.HtmlElement && parentProperty === 'children';
            if (parent.type === types_1.NodeTypes.LiquidBranch) {
                return parent;
            }
            else if (!isUnclosedHtmlElement) {
                throw new errors_1.LiquidHTMLASTParsingError(`Attempting to open LiquidBranch '${next.name}' before ${parent.type} '${getName(parent)}' was closed`, this.source, parent.position.start, next.position.end);
            }
        }
        return null;
    }
    // Check if there's a parent in the ancestry that this node correctly closes
    findCloseableParentNode(current) {
        for (let index = this.cursor.length - 1; index > 0; index -= 2) {
            const parent = (0, utils_1.deepGet)(this.cursor.slice(0, index), this.ast);
            if (getName(parent) === getName(current) &&
                parent.type === types_1.NodeTypes.LiquidTag &&
                ['if', 'unless', 'case'].includes(parent.name)) {
                return parent;
            }
            else if (parent.type === types_1.NodeTypes.LiquidTag) {
                return null;
            }
        }
        return null;
    }
    // sets the parent's end position to the start of the next one.
    closeParentWith(next) {
        if (this.parent) {
            if ('locStart' in next) {
                this.parent.position.end = next.locStart;
            }
            else {
                this.parent.position.end = next.position.start;
            }
        }
        this.cursor.pop();
        this.cursor.pop();
    }
}
function isLiquidBranch(node) {
    return !!node && node.type === types_1.NodeTypes.LiquidBranch;
}
function getName(node) {
    if (!node)
        return null;
    switch (node.type) {
        case types_1.NodeTypes.HtmlElement:
        case types_1.NodeTypes.HtmlDanglingMarkerClose:
        case types_1.NodeTypes.HtmlSelfClosingElement:
        case stage_1_cst_1.ConcreteNodeTypes.HtmlTagClose:
            return node.name
                .map((part) => {
                if (part.type === types_1.NodeTypes.TextNode || part.type == stage_1_cst_1.ConcreteNodeTypes.TextNode) {
                    return part.value;
                }
                else if (typeof part.markup === 'string') {
                    return `{{${part.markup.trim()}}}`;
                }
                else {
                    return `{{${part.markup.rawSource}}}`;
                }
            })
                .join('');
        case types_1.NodeTypes.AttrEmpty:
        case types_1.NodeTypes.AttrUnquoted:
        case types_1.NodeTypes.AttrDoubleQuoted:
        case types_1.NodeTypes.AttrSingleQuoted:
            // <a href="{{ hello }}">
            return node.name
                .map((part) => {
                if (typeof part === 'string') {
                    return part;
                }
                else {
                    return part.source.slice(part.position.start, part.position.end);
                }
            })
                .join('');
        default:
            return node.name;
    }
}
function cstToAst(cst, options) {
    var _a;
    if (cst.length === 0)
        return [];
    const builder = buildAst(cst, options);
    if (!options.allowUnclosedDocumentNode && builder.cursor.length !== 0) {
        throw new errors_1.LiquidHTMLASTParsingError(`Attempting to end parsing before ${(_a = builder.parent) === null || _a === void 0 ? void 0 : _a.type} '${getName(builder.parent)}' was closed`, builder.source, builder.source.length - 1, builder.source.length, getUnclosed(builder.parent, builder.grandparent));
    }
    return builder.ast;
}
function buildAst(cst, options) {
    var _a, _b, _c, _d;
    const builder = new ASTBuilder(cst[0].source);
    for (let i = 0; i < cst.length; i++) {
        const node = cst[i];
        switch (node.type) {
            case stage_1_cst_1.ConcreteNodeTypes.TextNode: {
                builder.push(toTextNode(node));
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidVariableOutput: {
                builder.push(toLiquidVariableOutput(node));
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidTagOpen: {
                builder.open(toLiquidTag(node, { ...options, isBlockTag: true }));
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidTagClose: {
                builder.close(node, types_1.NodeTypes.LiquidTag);
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidTag: {
                builder.push(toLiquidTag(node, { ...options, isBlockTag: false }));
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidRawTag: {
                builder.push({
                    type: types_1.NodeTypes.LiquidRawTag,
                    markup: markup(node.name, node.markup),
                    name: node.name,
                    body: toRawMarkup(node, options),
                    whitespaceStart: (_a = node.whitespaceStart) !== null && _a !== void 0 ? _a : '',
                    whitespaceEnd: (_b = node.whitespaceEnd) !== null && _b !== void 0 ? _b : '',
                    delimiterWhitespaceStart: (_c = node.delimiterWhitespaceStart) !== null && _c !== void 0 ? _c : '',
                    delimiterWhitespaceEnd: (_d = node.delimiterWhitespaceEnd) !== null && _d !== void 0 ? _d : '',
                    position: position(node),
                    blockStartPosition: {
                        start: node.blockStartLocStart,
                        end: node.blockStartLocEnd,
                    },
                    blockEndPosition: {
                        start: node.blockEndLocStart,
                        end: node.blockEndLocEnd,
                    },
                    source: node.source,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.HtmlTagOpen: {
                builder.open(toHtmlElement(node, options));
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.HtmlTagClose: {
                if (isAcceptableDanglingMarkerClose(builder, cst, i, options.mode)) {
                    builder.push(toHtmlDanglingMarkerClose(node, options));
                }
                else {
                    builder.close(node, types_1.NodeTypes.HtmlElement);
                }
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.HtmlVoidElement: {
                builder.push(toHtmlVoidElement(node, options));
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.HtmlSelfClosingElement: {
                builder.push(toHtmlSelfClosingElement(node, options));
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.HtmlDoctype: {
                builder.push({
                    type: types_1.NodeTypes.HtmlDoctype,
                    legacyDoctypeString: node.legacyDoctypeString,
                    position: position(node),
                    source: node.source,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.HtmlComment: {
                builder.push({
                    type: types_1.NodeTypes.HtmlComment,
                    body: node.body,
                    position: position(node),
                    source: node.source,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.HtmlRawTag: {
                builder.push({
                    type: types_1.NodeTypes.HtmlRawNode,
                    name: node.name,
                    body: toRawMarkup(node, options),
                    attributes: toAttributes(node.attrList || [], options),
                    position: position(node),
                    source: node.source,
                    blockStartPosition: {
                        start: node.blockStartLocStart,
                        end: node.blockStartLocEnd,
                    },
                    blockEndPosition: {
                        start: node.blockEndLocStart,
                        end: node.blockEndLocEnd,
                    },
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.AttrEmpty: {
                builder.push({
                    type: types_1.NodeTypes.AttrEmpty,
                    name: cstToAst(node.name, options),
                    position: position(node),
                    source: node.source,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.AttrSingleQuoted:
            case stage_1_cst_1.ConcreteNodeTypes.AttrDoubleQuoted:
            case stage_1_cst_1.ConcreteNodeTypes.AttrUnquoted: {
                const abstractNode = {
                    type: node.type,
                    name: cstToAst(node.name, options),
                    position: position(node),
                    source: node.source,
                    // placeholders
                    attributePosition: { start: -1, end: -1 },
                    value: [],
                };
                const value = toAttributeValue(node.value, options);
                abstractNode.value = value;
                abstractNode.attributePosition = toAttributePosition(node, value);
                builder.push(abstractNode);
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.YAMLFrontmatter: {
                builder.push({
                    type: types_1.NodeTypes.YAMLFrontmatter,
                    body: node.body,
                    position: position(node),
                    source: node.source,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidDocParamNode: {
                builder.push({
                    type: types_1.NodeTypes.LiquidDocParamNode,
                    name: node.name,
                    position: position(node),
                    source: node.source,
                    paramName: toTextNode(node.paramName.content),
                    paramDescription: toNullableTextNode(node.paramDescription),
                    paramType: toNullableTextNode(node.paramType),
                    required: node.paramName.required,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidDocDescriptionNode: {
                builder.push({
                    type: types_1.NodeTypes.LiquidDocDescriptionNode,
                    name: node.name,
                    position: position(node),
                    source: node.source,
                    content: toTextNode(node.content),
                    isImplicit: node.isImplicit,
                    isInline: node.isInline,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidDocExampleNode: {
                builder.push({
                    type: types_1.NodeTypes.LiquidDocExampleNode,
                    name: node.name,
                    position: position(node),
                    source: node.source,
                    content: toTextNode(node.content),
                    isInline: node.isInline,
                });
                break;
            }
            case stage_1_cst_1.ConcreteNodeTypes.LiquidDocPromptNode: {
                builder.push({
                    type: types_1.NodeTypes.LiquidDocPromptNode,
                    name: node.name,
                    position: position(node),
                    source: node.source,
                    content: toTextNode(node.content),
                });
                break;
            }
            default: {
                (0, utils_1.assertNever)(node);
            }
        }
    }
    return builder;
}
function nameLength(names) {
    const start = names.at(0);
    const end = names.at(-1);
    return end.locEnd - start.locStart;
}
function toAttributePosition(node, value) {
    if (value.length === 0) {
        // This is bugged when there's whitespace on either side. But I don't
        // think it's worth solving.
        return {
            start: node.locStart + nameLength(node.name) + '='.length + '"'.length,
            // name=""
            // 012345678
            // 0 + 4 + 1 + 1
            // = 6
            end: node.locStart + nameLength(node.name) + '='.length + '"'.length,
            // name=""
            // 012345678
            // 0 + 4 + 1 + 2
            // = 6
        };
    }
    return {
        start: value[0].position.start,
        end: value[value.length - 1].position.end,
    };
}
function toAttributeValue(value, options) {
    return cstToAst(value, options);
}
function toAttributes(attrList, options) {
    return cstToAst(attrList, options);
}
function liquidTagBaseAttributes(node) {
    var _a, _b;
    return {
        type: types_1.NodeTypes.LiquidTag,
        position: position(node),
        whitespaceStart: (_a = node.whitespaceStart) !== null && _a !== void 0 ? _a : '',
        whitespaceEnd: (_b = node.whitespaceEnd) !== null && _b !== void 0 ? _b : '',
        blockStartPosition: position(node),
        source: node.source,
    };
}
function liquidBranchBaseAttributes(node) {
    var _a, _b;
    return {
        type: types_1.NodeTypes.LiquidBranch,
        children: [],
        position: position(node),
        whitespaceStart: (_a = node.whitespaceStart) !== null && _a !== void 0 ? _a : '',
        whitespaceEnd: (_b = node.whitespaceEnd) !== null && _b !== void 0 ? _b : '',
        blockStartPosition: position(node),
        blockEndPosition: { start: -1, end: -1 },
        source: node.source,
    };
}
function toLiquidTag(node, options) {
    if (typeof node.markup !== 'string') {
        return toNamedLiquidTag(node, options);
    }
    else if (isConcreteLiquidBranchDisguisedAsTag(node)) {
        // `elsif`, `else`, `case`, but with unparseable markup.
        return toNamedLiquidBranchBaseCase(node);
    }
    else if (options.isBlockTag) {
        return {
            name: node.name,
            markup: markup(node.name, node.markup),
            children: options.isBlockTag ? [] : undefined,
            ...liquidTagBaseAttributes(node),
        };
    }
    return {
        name: node.name,
        markup: markup(node.name, node.markup),
        ...liquidTagBaseAttributes(node),
    };
}
function toNamedLiquidTag(node, options) {
    switch (node.name) {
        case types_1.NamedTags.echo: {
            return {
                ...liquidTagBaseAttributes(node),
                name: types_1.NamedTags.echo,
                markup: toLiquidVariable(node.markup),
            };
        }
        case types_1.NamedTags.assign: {
            return {
                ...liquidTagBaseAttributes(node),
                name: types_1.NamedTags.assign,
                markup: toAssignMarkup(node.markup),
            };
        }
        case types_1.NamedTags.cycle: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toCycleMarkup(node.markup),
            };
        }
        case types_1.NamedTags.increment:
        case types_1.NamedTags.decrement: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toExpression(node.markup),
            };
        }
        case types_1.NamedTags.capture: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toExpression(node.markup),
                children: [],
            };
        }
        case types_1.NamedTags.content_for: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toContentForMarkup(node.markup),
            };
        }
        case types_1.NamedTags.include:
        case types_1.NamedTags.render: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toRenderMarkup(node.markup),
            };
        }
        case types_1.NamedTags.layout:
        case types_1.NamedTags.section: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toExpression(node.markup),
            };
        }
        case types_1.NamedTags.sections: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toExpression(node.markup),
            };
        }
        case types_1.NamedTags.form: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: node.markup.map(toLiquidArgument),
                children: [],
            };
        }
        case types_1.NamedTags.tablerow:
        case types_1.NamedTags.for: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toForMarkup(node.markup),
                children: [],
            };
        }
        case types_1.NamedTags.paginate: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toPaginateMarkup(node.markup),
                children: [],
            };
        }
        case types_1.NamedTags.if:
        case types_1.NamedTags.unless: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toConditionalExpression(node.markup),
                blockEndPosition: { start: -1, end: -1 },
                children: [],
            };
        }
        case types_1.NamedTags.elsif: {
            return {
                ...liquidBranchBaseAttributes(node),
                name: node.name,
                markup: toConditionalExpression(node.markup),
            };
        }
        case types_1.NamedTags.case: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: toExpression(node.markup),
                children: [],
            };
        }
        case types_1.NamedTags.when: {
            return {
                ...liquidBranchBaseAttributes(node),
                name: node.name,
                markup: node.markup.map(toExpression),
            };
        }
        case types_1.NamedTags.liquid: {
            return {
                ...liquidTagBaseAttributes(node),
                name: node.name,
                markup: cstToAst(node.markup, options),
            };
        }
        default: {
            return (0, utils_1.assertNever)(node);
        }
    }
}
function toNamedLiquidBranchBaseCase(node) {
    var _a, _b;
    return {
        name: node.name,
        type: types_1.NodeTypes.LiquidBranch,
        markup: node.name !== 'else' ? node.markup : '', // stripping superfluous else stuff...
        position: { start: node.locStart, end: node.locEnd },
        children: [],
        blockStartPosition: { start: node.locStart, end: node.locEnd },
        blockEndPosition: { start: -1, end: -1 },
        whitespaceStart: (_a = node.whitespaceStart) !== null && _a !== void 0 ? _a : '',
        whitespaceEnd: (_b = node.whitespaceEnd) !== null && _b !== void 0 ? _b : '',
        source: node.source,
    };
}
function toUnnamedLiquidBranch(parentNode) {
    return {
        type: types_1.NodeTypes.LiquidBranch,
        name: null,
        markup: '',
        position: { start: parentNode.position.end, end: parentNode.position.end },
        blockStartPosition: { start: parentNode.position.end, end: parentNode.position.end },
        blockEndPosition: { start: -1, end: -1 },
        children: [],
        whitespaceStart: '',
        whitespaceEnd: '',
        source: parentNode.source,
    };
}
function toAssignMarkup(node) {
    return {
        type: types_1.NodeTypes.AssignMarkup,
        name: node.name,
        value: toLiquidVariable(node.value),
        position: position(node),
        source: node.source,
    };
}
function toCycleMarkup(node) {
    return {
        type: types_1.NodeTypes.CycleMarkup,
        groupName: node.groupName ? toExpression(node.groupName) : null,
        args: node.args.map(toExpression),
        position: position(node),
        source: node.source,
    };
}
function toForMarkup(node) {
    return {
        type: types_1.NodeTypes.ForMarkup,
        variableName: node.variableName,
        collection: toExpression(node.collection),
        args: node.args.map(toNamedArgument),
        reversed: !!node.reversed,
        position: position(node),
        source: node.source,
    };
}
function toPaginateMarkup(node) {
    return {
        type: types_1.NodeTypes.PaginateMarkup,
        collection: toExpression(node.collection),
        pageSize: toExpression(node.pageSize),
        position: position(node),
        args: node.args ? node.args.map(toNamedArgument) : [],
        source: node.source,
    };
}
function toRawMarkup(node, options) {
    return {
        type: types_1.NodeTypes.RawMarkup,
        kind: toRawMarkupKind(node),
        nodes: cstToAst(node.children, options),
        value: node.body,
        position: {
            start: node.blockStartLocEnd,
            end: node.blockEndLocStart,
        },
        source: node.source,
    };
}
function toRawMarkupKind(node) {
    switch (node.type) {
        case stage_1_cst_1.ConcreteNodeTypes.HtmlRawTag:
            return toRawMarkupKindFromHtmlNode(node);
        case stage_1_cst_1.ConcreteNodeTypes.LiquidRawTag:
            return toRawMarkupKindFromLiquidNode(node);
        default:
            return (0, utils_1.assertNever)(node);
    }
}
const liquidToken = /(\{%|\{\{)-?/g;
function toRawMarkupKindFromHtmlNode(node) {
    var _a;
    switch (node.name) {
        case 'script': {
            const scriptAttr = (_a = node.attrList) === null || _a === void 0 ? void 0 : _a.find((attr) => 'name' in attr &&
                typeof attr.name !== 'string' &&
                attr.name.length === 1 &&
                attr.name[0].type === stage_1_cst_1.ConcreteNodeTypes.TextNode &&
                attr.name[0].value === 'type');
            if (!scriptAttr ||
                !('value' in scriptAttr) ||
                scriptAttr.value.length === 0 ||
                scriptAttr.value[0].type !== stage_1_cst_1.ConcreteNodeTypes.TextNode) {
                return RawMarkupKinds.javascript;
            }
            const type = scriptAttr.value[0].value;
            if (type === 'text/markdown') {
                return RawMarkupKinds.markdown;
            }
            if (type === 'application/x-typescript') {
                return RawMarkupKinds.typescript;
            }
            if (type === 'text/html') {
                return RawMarkupKinds.html;
            }
            if ((type && (type.endsWith('json') || type.endsWith('importmap'))) ||
                type === 'speculationrules') {
                return RawMarkupKinds.json;
            }
            return RawMarkupKinds.javascript;
        }
        case 'style':
            if (liquidToken.test(node.body)) {
                return RawMarkupKinds.text;
            }
            return RawMarkupKinds.css;
        default:
            return RawMarkupKinds.text;
    }
}
function toRawMarkupKindFromLiquidNode(node) {
    switch (node.name) {
        case 'javascript':
            return RawMarkupKinds.javascript;
        case 'stylesheet':
        case 'style':
            if (liquidToken.test(node.body)) {
                return RawMarkupKinds.text;
            }
            return RawMarkupKinds.css;
        case 'schema':
            return RawMarkupKinds.json;
        default:
            return RawMarkupKinds.text;
    }
}
function toContentForMarkup(node) {
    return {
        type: types_1.NodeTypes.ContentForMarkup,
        contentForType: toExpression(node.contentForType),
        /**
         * When we're in completion mode we won't necessarily have valid named
         * arguments so we need to call toLiquidArgument instead of toNamedArgument.
         * We cast using `as` so that this doesn't affect the type system used in
         * other areas (like theme check) for a scenario that only occurs in
         * completion mode. This means that our types are *wrong* in completion mode
         * but this is the compromise we're making to get completions to work.
         */
        args: node.args.map(toLiquidArgument),
        position: position(node),
        source: node.source,
    };
}
function toRenderMarkup(node) {
    return {
        type: types_1.NodeTypes.RenderMarkup,
        snippet: toExpression(node.snippet),
        alias: toRenderAliasExpression(node.alias),
        variable: toRenderVariableExpression(node.variable),
        /**
         * When we're in completion mode we won't necessarily have valid named
         * arguments so we need to call toLiquidArgument instead of toNamedArgument.
         * We cast using `as` so that this doesn't affect the type system used in
         * other areas (like theme check) for a scenario that only occurs in
         * completion mode. This means that our types are *wrong* in completion mode
         * but this is the compromise we're making to get completions to work.
         */
        args: node.renderArguments.map(toLiquidArgument),
        position: position(node),
        source: node.source,
    };
}
function toRenderVariableExpression(node) {
    if (!node)
        return null;
    return {
        type: types_1.NodeTypes.RenderVariableExpression,
        kind: node.kind,
        name: toExpression(node.name),
        position: position(node),
        source: node.source,
    };
}
function toRenderAliasExpression(node) {
    if (!node)
        return null;
    return {
        type: types_1.NodeTypes.RenderAliasExpression,
        value: node.value,
        position: position(node),
        source: node.source,
    };
}
function toConditionalExpression(nodes) {
    if (nodes.length === 1) {
        return toComparisonOrExpression(nodes[0]);
    }
    const [first, second] = nodes;
    const [, ...rest] = nodes;
    return {
        type: types_1.NodeTypes.LogicalExpression,
        relation: second.relation,
        left: toComparisonOrExpression(first),
        right: toConditionalExpression(rest),
        position: {
            start: first.locStart,
            end: nodes[nodes.length - 1].locEnd,
        },
        source: first.source,
    };
}
function toComparisonOrExpression(node) {
    const expression = node.expression;
    switch (expression.type) {
        case stage_1_cst_1.ConcreteNodeTypes.Comparison:
            return toComparison(expression);
        default:
            return toExpression(expression);
    }
}
function toComparison(node) {
    return {
        type: types_1.NodeTypes.Comparison,
        comparator: node.comparator,
        left: toExpression(node.left),
        right: toExpression(node.right),
        position: position(node),
        source: node.source,
    };
}
function toLiquidVariableOutput(node) {
    var _a, _b;
    return {
        type: types_1.NodeTypes.LiquidVariableOutput,
        markup: typeof node.markup === 'string' ? node.markup : toLiquidVariable(node.markup),
        whitespaceStart: (_a = node.whitespaceStart) !== null && _a !== void 0 ? _a : '',
        whitespaceEnd: (_b = node.whitespaceEnd) !== null && _b !== void 0 ? _b : '',
        position: position(node),
        source: node.source,
    };
}
function toLiquidVariable(node) {
    return {
        type: types_1.NodeTypes.LiquidVariable,
        expression: toComplexExpression(node.expression),
        filters: node.filters.map(toFilter),
        position: position(node),
        rawSource: node.rawSource,
        source: node.source,
    };
}
function toComplexExpression(node) {
    switch (node.type) {
        case stage_1_cst_1.ConcreteNodeTypes.BooleanExpression: {
            return {
                type: types_1.NodeTypes.BooleanExpression,
                position: position(node),
                condition: toConditionalExpression(node.conditions),
                source: node.source,
            };
        }
        default: {
            return toExpression(node);
        }
    }
}
function toExpression(node) {
    switch (node.type) {
        case stage_1_cst_1.ConcreteNodeTypes.String: {
            return {
                type: types_1.NodeTypes.String,
                position: position(node),
                single: node.single,
                value: node.value,
                source: node.source,
            };
        }
        case stage_1_cst_1.ConcreteNodeTypes.Number: {
            return {
                type: types_1.NodeTypes.Number,
                position: position(node),
                value: node.value,
                source: node.source,
            };
        }
        case stage_1_cst_1.ConcreteNodeTypes.LiquidLiteral: {
            return {
                type: types_1.NodeTypes.LiquidLiteral,
                position: position(node),
                value: node.value,
                keyword: node.keyword,
                source: node.source,
            };
        }
        case stage_1_cst_1.ConcreteNodeTypes.Range: {
            return {
                type: types_1.NodeTypes.Range,
                start: toExpression(node.start),
                end: toExpression(node.end),
                position: position(node),
                source: node.source,
            };
        }
        case stage_1_cst_1.ConcreteNodeTypes.VariableLookup: {
            return {
                type: types_1.NodeTypes.VariableLookup,
                name: node.name,
                lookups: node.lookups.map(toExpression),
                position: position(node),
                source: node.source,
            };
        }
        default: {
            return (0, utils_1.assertNever)(node);
        }
    }
}
function toFilter(node) {
    return {
        type: types_1.NodeTypes.LiquidFilter,
        name: node.name,
        args: node.args.map(toLiquidArgument),
        position: position(node),
        source: node.source,
    };
}
function toLiquidArgument(node) {
    switch (node.type) {
        case stage_1_cst_1.ConcreteNodeTypes.NamedArgument: {
            return toNamedArgument(node);
        }
        default: {
            return toExpression(node);
        }
    }
}
function toNamedArgument(node) {
    return {
        type: types_1.NodeTypes.NamedArgument,
        name: node.name,
        value: toExpression(node.value),
        position: position(node),
        source: node.source,
    };
}
function toHtmlElement(node, options) {
    return {
        type: types_1.NodeTypes.HtmlElement,
        name: cstToAst(node.name, options),
        attributes: toAttributes(node.attrList || [], options),
        position: position(node),
        blockStartPosition: position(node),
        blockEndPosition: { start: -1, end: -1 },
        children: [],
        source: node.source,
    };
}
function toHtmlDanglingMarkerClose(node, options) {
    return {
        type: types_1.NodeTypes.HtmlDanglingMarkerClose,
        name: cstToAst(node.name, options),
        position: position(node),
        blockStartPosition: position(node),
        source: node.source,
    };
}
function toHtmlVoidElement(node, options) {
    return {
        type: types_1.NodeTypes.HtmlVoidElement,
        name: node.name,
        attributes: toAttributes(node.attrList || [], options),
        position: position(node),
        blockStartPosition: position(node),
        source: node.source,
    };
}
function toHtmlSelfClosingElement(node, options) {
    return {
        type: types_1.NodeTypes.HtmlSelfClosingElement,
        name: cstToAst(node.name, options),
        attributes: toAttributes(node.attrList || [], options),
        position: position(node),
        blockStartPosition: position(node),
        source: node.source,
    };
}
function toNullableTextNode(node) {
    if (!node || node.value === '')
        return null;
    return toTextNode(node);
}
function toTextNode(node) {
    return {
        type: types_1.NodeTypes.TextNode,
        value: node.value,
        position: position(node),
        source: node.source,
    };
}
function isAcceptableDanglingMarkerClose(builder, cst, currIndex, mode) {
    if (mode === 'completion') {
        const current = cst[currIndex];
        const parentIsOfCorrectName = builder.parent &&
            builder.parent.type === types_1.NodeTypes.HtmlElement &&
            getName(builder.parent) === getName(current);
        return !parentIsOfCorrectName;
    }
    return isAcceptableDanglingMarker(builder);
}
// This function checks that the builder.current node accepts dangling nodes.
//
// The current logic is:
//  - Grandparent node must be an if-like statement
//  - Parent node must be a LiquidBranch
function isAcceptableDanglingMarker(builder) {
    const { parent, grandparent } = builder;
    if (!parent || !grandparent)
        return false;
    return (parent.type === types_1.NodeTypes.LiquidBranch &&
        grandparent.type === types_1.NodeTypes.LiquidTag &&
        ['if', 'unless', 'case'].includes(grandparent.name));
}
// checking that is a {% else %} or {% endif %}
function isConcreteExceptionEnd(node) {
    return (!node ||
        node.type === stage_1_cst_1.ConcreteNodeTypes.LiquidTagClose ||
        isConcreteLiquidBranchDisguisedAsTag(node));
}
function markup(name, markup) {
    if (grammar_1.TAGS_WITHOUT_MARKUP.includes(name))
        return '';
    return markup;
}
function position(node) {
    return {
        start: node.locStart,
        end: node.locEnd,
    };
}
function walk(ast, fn, parentNode) {
    for (const key of Object.keys(ast)) {
        if (types_1.nonTraversableProperties.has(key)) {
            continue;
        }
        const value = ast[key];
        if (Array.isArray(value)) {
            value.filter(isLiquidHtmlNode).forEach((node) => walk(node, fn, ast));
        }
        else if (isLiquidHtmlNode(value)) {
            walk(value, fn, ast);
        }
    }
    fn(ast, parentNode);
}
function isLiquidHtmlNode(value) {
    return (value !== null &&
        typeof value === 'object' &&
        'type' in value &&
        types_1.NodeTypes.hasOwnProperty(value.type));
}
function getUnclosed(node, parentNode) {
    var _a;
    if (!node)
        return undefined;
    if (getName(node) === null && parentNode) {
        node = parentNode;
    }
    return {
        type: node.type,
        name: (_a = getName(node)) !== null && _a !== void 0 ? _a : '',
        blockStartPosition: 'blockStartPosition' in node ? node.blockStartPosition : node.position,
    };
}
//# sourceMappingURL=stage-2-ast.js.map