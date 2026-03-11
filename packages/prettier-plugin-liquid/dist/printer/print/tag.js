"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.needsToBorrowPrevClosingTagEndMarker = needsToBorrowPrevClosingTagEndMarker;
exports.needsToBorrowLastChildClosingTagEndMarker = needsToBorrowLastChildClosingTagEndMarker;
exports.needsToBorrowParentClosingTagStartMarker = needsToBorrowParentClosingTagStartMarker;
exports.needsToBorrowNextOpeningTagStartMarker = needsToBorrowNextOpeningTagStartMarker;
exports.needsToBorrowParentOpeningTagEndMarker = needsToBorrowParentOpeningTagEndMarker;
exports.printOpeningTag = printOpeningTag;
exports.printOpeningTagStart = printOpeningTagStart;
exports.printOpeningTagPrefix = printOpeningTagPrefix;
exports.printOpeningTagStartMarker = printOpeningTagStartMarker;
exports.printClosingTag = printClosingTag;
exports.printClosingTagStart = printClosingTagStart;
exports.printClosingTagEnd = printClosingTagEnd;
exports.printClosingTagSuffix = printClosingTagSuffix;
exports.printClosingTagStartMarker = printClosingTagStartMarker;
exports.printClosingTagEndMarker = printClosingTagEndMarker;
exports.printOpeningTagEndMarker = printOpeningTagEndMarker;
exports.getNodeContent = getNodeContent;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const prettier_1 = require("prettier");
const utils_1 = require("../utils");
const { builders: { breakParent, indent, join, line, softline, hardline }, } = prettier_1.doc;
const { replaceEndOfLine } = prettier_1.doc.utils;
function shouldNotPrintClosingTag(node, _options) {
    return (!(0, utils_1.hasNoCloseMarker)(node) && // has close marker
        !node.blockEndPosition && // does not have blockEndPosition
        ((0, utils_1.hasPrettierIgnore)(node) || (0, utils_1.shouldPreserveContent)(node.parentNode)));
}
function needsToBorrowPrevClosingTagEndMarker(node) {
    /**
     *     <p></p
     *     >123
     *     ^
     *
     *     <p></p
     *     ><a
     *     ^
     */
    return (!(0, utils_1.isLiquidNode)(node) &&
        node.prev &&
        // node.prev.type !== 'docType' &&
        (0, utils_1.isHtmlNode)(node.prev) &&
        (0, utils_1.hasMeaningfulLackOfLeadingWhitespace)(node));
}
function needsToBorrowLastChildClosingTagEndMarker(node) {
    /**
     *     <p
     *       ><a></a
     *       ></p
     *       ^
     *     >
     */
    return ((0, utils_1.isHtmlNode)(node) &&
        node.lastChild &&
        (0, utils_1.hasMeaningfulLackOfTrailingWhitespace)(node.lastChild) &&
        (0, utils_1.isHtmlNode)((0, utils_1.getLastDescendant)(node.lastChild)) &&
        !(0, utils_1.isPreLikeNode)(node));
}
function needsToBorrowParentClosingTagStartMarker(node) {
    /**
     *     <p>
     *       123</p
     *          ^^^
     *     >
     *
     *         123</b
     *       ></a
     *        ^^^
     *     >
     */
    return ((0, utils_1.isHtmlNode)(node.parentNode) &&
        !node.next &&
        (0, utils_1.hasMeaningfulLackOfTrailingWhitespace)(node) &&
        !(0, utils_1.isLiquidNode)(node) &&
        ((0, utils_1.isTextLikeNode)((0, utils_1.getLastDescendant)(node)) || (0, utils_1.isLiquidNode)((0, utils_1.getLastDescendant)(node))));
}
function needsToBorrowNextOpeningTagStartMarker(node) {
    /**
     *     123<p
     *        ^^
     *     >
     */
    return (node.next &&
        (0, utils_1.isHtmlNode)(node.next) &&
        (0, utils_1.isTextLikeNode)(node) &&
        (0, utils_1.hasMeaningfulLackOfTrailingWhitespace)(node));
}
function needsToBorrowParentOpeningTagEndMarker(node) {
    /**
     *     <p
     *       >123
     *       ^
     *
     *     <p
     *       ><a
     *       ^
     */
    return ((0, utils_1.isHtmlNode)(node.parentNode) &&
        !node.prev &&
        (0, utils_1.hasMeaningfulLackOfLeadingWhitespace)(node) &&
        !(0, utils_1.isLiquidNode)(node));
}
/**
 * This is so complicated :')
 */
function printAttributes(path, options, print, attrGroupId) {
    const node = path.getValue();
    if ((0, utils_1.isHtmlComment)(node))
        return '';
    if (node.type === liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose)
        return '';
    if (node.attributes.length === 0) {
        return (0, utils_1.isSelfClosing)(node)
            ? /**
               *     <br />
               *        ^
               */
                ' '
            : '';
    }
    const prettierIgnoreAttributes = (0, utils_1.isPrettierIgnoreAttributeNode)(node.prev);
    const printedAttributes = path.map((attr) => {
        const attrNode = attr.getValue();
        let extraNewline = '';
        if (attrNode.prev &&
            (0, utils_1.hasMoreThanOneNewLineBetweenNodes)(attrNode.source, attrNode.prev, attrNode)) {
            extraNewline = hardline;
        }
        const printed = print(attr, { trailingSpaceGroupId: attrGroupId });
        return [extraNewline, printed];
    }, 'attributes');
    const forceBreakAttrContent = node.source
        .slice(node.blockStartPosition.start, (0, utils_1.last)(node.attributes).position.end)
        .includes('\n');
    const isSingleLineLinkTagException = options.singleLineLinkTags && typeof node.name === 'string' && node.name === 'link';
    const shouldNotBreakAttributes = (((0, utils_1.isHtmlElement)(node) && node.children.length > 0) ||
        (0, utils_1.isVoidElement)(node) ||
        (0, utils_1.isSelfClosing)(node)) &&
        !forceBreakAttrContent &&
        node.attributes.length === 1 &&
        !(0, utils_1.isLiquidNode)(node.attributes[0]);
    const forceNotToBreakAttrContent = isSingleLineLinkTagException || shouldNotBreakAttributes;
    const whitespaceBetweenAttributes = forceNotToBreakAttrContent
        ? ' '
        : options.singleAttributePerLine && node.attributes.length > 1
            ? hardline
            : line;
    const attributes = prettierIgnoreAttributes
        ? replaceEndOfLine(node.source.slice((0, utils_1.first)(node.attributes).position.start, (0, utils_1.last)(node.attributes).position.end))
        : join(whitespaceBetweenAttributes, printedAttributes);
    let trailingInnerWhitespace;
    if (
    /**
     *     123<a
     *       attr
     *           ~
     *       >456
     */
    (node.firstChild && needsToBorrowParentOpeningTagEndMarker(node.firstChild)) ||
        /**
         *     <span
         *       >123<meta
         *                ~
         *     /></span>
         */
        ((0, utils_1.hasNoCloseMarker)(node) && needsToBorrowLastChildClosingTagEndMarker(node.parentNode)) ||
        forceNotToBreakAttrContent) {
        trailingInnerWhitespace = (0, utils_1.isSelfClosing)(node) ? ' ' : '';
    }
    else {
        trailingInnerWhitespace = options.bracketSameLine
            ? (0, utils_1.isSelfClosing)(node)
                ? ' '
                : ''
            : (0, utils_1.isSelfClosing)(node)
                ? line
                : softline;
    }
    return [
        indent([
            forceNotToBreakAttrContent ? ' ' : line,
            forceBreakAttrContent ? breakParent : '',
            attributes,
        ]),
        trailingInnerWhitespace,
    ];
}
function printOpeningTag(path, options, print, attrGroupId) {
    const node = path.getValue();
    return [
        printOpeningTagStart(node, options),
        printAttributes(path, options, print, attrGroupId),
        (0, utils_1.hasNoChildren)(node) ? '' : printOpeningTagEnd(node),
    ];
}
// If the current node's `<` isn't borrowed by the previous node, will print the prefix and `<`
function printOpeningTagStart(node, options) {
    return node.prev && needsToBorrowNextOpeningTagStartMarker(node.prev)
        ? ''
        : [printOpeningTagPrefix(node, options), printOpeningTagStartMarker(node)];
}
// The opening tag prefix is the mechanism we use to "borrow" closing tags to maintain lack of whitespace
// It will print the parent's or the previous node's `>` if we need to.
function printOpeningTagPrefix(node, options) {
    return needsToBorrowParentOpeningTagEndMarker(node)
        ? printOpeningTagEndMarker(node.parentNode) // opening tag '>' of parent
        : needsToBorrowPrevClosingTagEndMarker(node)
            ? printClosingTagEndMarker(node.prev, options) // closing '>' of previous
            : '';
}
// Will maybe print the `>` of the node.
//   If the first child needs to borrow the `>`, we won't print it
//
//   <a
//     ><img
//     ^ this is the opening tag end. Might be borrowed by the first child.
//   ></a>
function printOpeningTagEnd(node) {
    return node.firstChild && needsToBorrowParentOpeningTagEndMarker(node.firstChild)
        ? ''
        : printOpeningTagEndMarker(node);
}
// Print the `<` equivalent for the node.
function printOpeningTagStartMarker(node) {
    if (!node)
        return '';
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.HtmlComment:
            return '<!--';
        case liquid_html_parser_1.NodeTypes.HtmlElement:
        case liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement:
            return `<${getCompoundName(node)}`;
        case liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose:
            return `</${getCompoundName(node)}`;
        case liquid_html_parser_1.NodeTypes.HtmlVoidElement:
        case liquid_html_parser_1.NodeTypes.HtmlRawNode:
            return `<${node.name}`;
        default:
            return ''; // TODO
    }
}
// this function's job is to print the closing part of the tag </a>
// curious: it also prints void elements `>` and self closing node's `/>`
//   that's because we might want to borrow it
function printClosingTag(node, options) {
    return [
        (0, utils_1.hasNoCloseMarker)(node) ? '' : printClosingTagStart(node, options),
        printClosingTagEnd(node, options),
    ];
}
function printClosingTagStart(node, options) {
    return node.lastChild && needsToBorrowParentClosingTagStartMarker(node.lastChild)
        ? ''
        : [printClosingTagPrefix(node, options), printClosingTagStartMarker(node, options)];
}
function printClosingTagEnd(node, options) {
    return (node.next
        ? needsToBorrowPrevClosingTagEndMarker(node.next)
        : needsToBorrowLastChildClosingTagEndMarker(node.parentNode))
        ? ''
        : [printClosingTagEndMarker(node, options), printClosingTagSuffix(node, options)];
}
function printClosingTagPrefix(node, options) {
    return needsToBorrowLastChildClosingTagEndMarker(node)
        ? printClosingTagEndMarker(node.lastChild, options)
        : '';
}
function printClosingTagSuffix(node, options) {
    return needsToBorrowParentClosingTagStartMarker(node)
        ? printClosingTagStartMarker(node.parentNode, options)
        : needsToBorrowNextOpeningTagStartMarker(node)
            ? printOpeningTagStartMarker(node.next)
            : '';
}
function printClosingTagStartMarker(node, options) {
    if (!node)
        return '';
    /* istanbul ignore next */
    if (shouldNotPrintClosingTag(node, options)) {
        return '';
    }
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.HtmlElement:
            return `</${getCompoundName(node)}`;
        case liquid_html_parser_1.NodeTypes.HtmlRawNode:
            return `</${node.name}`;
        default:
            return '';
    }
}
function printClosingTagEndMarker(node, options) {
    if (!node)
        return '';
    if (shouldNotPrintClosingTag(node, options) || (0, utils_1.isHtmlDanglingMarkerOpen)(node)) {
        return '';
    }
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement: {
            // looks like it doesn't make sense because it should be part of
            // the printOpeningTagEndMarker but this is handled somewhere else.
            // This function is used to determine what to borrow so the "end" to
            // borrow is actually the other end.
            return '/>';
        }
        default:
            return '>';
    }
}
// Print the opening tag's `>`
function printOpeningTagEndMarker(node) {
    if (!node)
        return '';
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.HtmlComment:
            return '-->';
        case liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement:
        case liquid_html_parser_1.NodeTypes.HtmlVoidElement:
            return ''; // the `>` is printed by the printClosingTagEndMarker for self closing things
        case liquid_html_parser_1.NodeTypes.HtmlElement:
        case liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose:
        // TODO why is this one not with the other group?
        case liquid_html_parser_1.NodeTypes.HtmlRawNode:
            return '>';
        default:
            return '>';
    }
}
function getNodeContent(node, options) {
    let start = node.blockStartPosition.end;
    if (node.firstChild && needsToBorrowParentOpeningTagEndMarker(node.firstChild)) {
        start -= printOpeningTagEndMarker(node).length;
    }
    let end = node.blockEndPosition.start;
    if (node.lastChild && needsToBorrowParentClosingTagStartMarker(node.lastChild)) {
        end += printClosingTagStartMarker(node, options).length;
    }
    else if (node.lastChild && needsToBorrowLastChildClosingTagEndMarker(node)) {
        end -= printClosingTagEndMarker(node.lastChild, options).length;
    }
    return options.originalText.slice(start, end);
}
function getCompoundName(node) {
    return node.name
        .map((part) => {
        if (part.type === liquid_html_parser_1.NodeTypes.TextNode) {
            return part.value;
        }
        else if (typeof part.markup === 'string') {
            return `{{ ${part.markup.trim()} }}`;
        }
        else {
            return `{{ ${part.markup.rawSource} }}`;
        }
    })
        .join('');
}
//# sourceMappingURL=tag.js.map