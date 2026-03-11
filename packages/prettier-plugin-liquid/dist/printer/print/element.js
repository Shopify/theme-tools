'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.printRawElement = printRawElement;
exports.printElement = printElement;
const prettier_1 = require("prettier");
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const utils_1 = require("../utils");
const tag_1 = require("./tag");
const children_1 = require("./children");
const { builders: { breakParent, dedentToRoot, group, indent, hardline, line, softline }, } = prettier_1.doc;
const { replaceEndOfLine } = prettier_1.doc.utils;
function printRawElement(path, options, print, _args) {
    const node = path.getValue();
    const attrGroupId = Symbol('element-attr-group-id');
    let body = [];
    const hasEmptyBody = node.body.value.trim() === '';
    if (!hasEmptyBody) {
        body = [path.call((p) => print(p), 'body')];
    }
    return group([
        (0, tag_1.printOpeningTagPrefix)(node, options),
        group((0, tag_1.printOpeningTag)(path, options, print, attrGroupId), {
            id: attrGroupId,
        }),
        ...body,
        ...(0, tag_1.printClosingTag)(node, options),
        (0, tag_1.printClosingTagSuffix)(node, options),
    ]);
}
function printElement(path, options, print, args) {
    const node = path.getValue();
    const attrGroupId = Symbol('element-attr-group-id');
    const elementGroupId = Symbol('element-group-id');
    if (node.type === liquid_html_parser_1.NodeTypes.HtmlRawNode) {
        return printRawElement(path, options, print, args);
    }
    if ((0, utils_1.hasNoChildren)(node)) {
        // TODO, broken for HtmlComment but this code path is not used (so far).
        return [
            group((0, tag_1.printOpeningTag)(path, options, print, attrGroupId), {
                id: attrGroupId,
            }),
            ...(0, tag_1.printClosingTag)(node, options),
            (0, tag_1.printClosingTagSuffix)(node, options),
        ];
    }
    if ((0, utils_1.shouldPreserveContent)(node)) {
        return [
            (0, tag_1.printOpeningTagPrefix)(node, options),
            group((0, tag_1.printOpeningTag)(path, options, print, attrGroupId), {
                id: attrGroupId,
            }),
            ...replaceEndOfLine((0, tag_1.getNodeContent)(node, options)),
            ...(0, tag_1.printClosingTag)(node, options),
            (0, tag_1.printClosingTagSuffix)(node, options),
        ];
    }
    const printTag = (doc) => group([
        group((0, tag_1.printOpeningTag)(path, options, print, attrGroupId), {
            id: attrGroupId,
        }),
        doc,
        (0, tag_1.printClosingTag)(node, options),
    ], { id: elementGroupId });
    const printLineBeforeChildren = () => {
        if (node.firstChild.hasLeadingWhitespace && node.firstChild.isLeadingWhitespaceSensitive) {
            return line;
        }
        if (node.firstChild.type === liquid_html_parser_1.NodeTypes.TextNode &&
            node.isWhitespaceSensitive &&
            node.isIndentationSensitive) {
            return dedentToRoot(softline);
        }
        return softline;
    };
    const printLineAfterChildren = () => {
        // does not have the closing tag
        if (node.blockEndPosition.start === node.blockEndPosition.end) {
            return '';
        }
        const needsToBorrow = node.next
            ? (0, tag_1.needsToBorrowPrevClosingTagEndMarker)(node.next)
            : (0, tag_1.needsToBorrowLastChildClosingTagEndMarker)(node.parentNode);
        if (needsToBorrow) {
            if (node.lastChild.hasTrailingWhitespace && node.lastChild.isTrailingWhitespaceSensitive) {
                return ' ';
            }
            return '';
        }
        if (node.lastChild.hasTrailingWhitespace && node.lastChild.isTrailingWhitespaceSensitive) {
            return line;
        }
        return softline;
    };
    if (node.children.length === 0) {
        return printTag(node.hasDanglingWhitespace &&
            node.isDanglingWhitespaceSensitive &&
            node.blockEndPosition.end !== node.blockEndPosition.start
            ? line
            : '');
    }
    return printTag([
        (0, utils_1.forceBreakContent)(node) ? breakParent : '',
        indent([
            printLineBeforeChildren(),
            (0, children_1.printChildren)(path, options, print, {
                leadingSpaceGroupId: elementGroupId,
                trailingSpaceGroupId: elementGroupId,
            }),
        ]),
        printLineAfterChildren(),
    ]);
}
//# sourceMappingURL=element.js.map