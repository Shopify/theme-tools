"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isScriptLikeTag = isScriptLikeTag;
exports.isPreLikeNode = isPreLikeNode;
exports.hasNoCloseMarker = hasNoCloseMarker;
exports.hasNoChildren = hasNoChildren;
exports.isHtmlDanglingMarkerOpen = isHtmlDanglingMarkerOpen;
exports.isHtmlDanglingMarkerClose = isHtmlDanglingMarkerClose;
exports.isHtmlComment = isHtmlComment;
exports.isSelfClosing = isSelfClosing;
exports.isVoidElement = isVoidElement;
exports.isHtmlElement = isHtmlElement;
exports.isTextLikeNode = isTextLikeNode;
exports.isLiquidNode = isLiquidNode;
exports.isMultilineLiquidTag = isMultilineLiquidTag;
exports.isHtmlNode = isHtmlNode;
exports.isAttributeNode = isAttributeNode;
exports.hasNonTextChild = hasNonTextChild;
exports.shouldPreserveContent = shouldPreserveContent;
exports.isPrettierIgnoreHtmlNode = isPrettierIgnoreHtmlNode;
exports.isPrettierIgnoreLiquidNode = isPrettierIgnoreLiquidNode;
exports.isPrettierIgnoreNode = isPrettierIgnoreNode;
exports.hasPrettierIgnore = hasPrettierIgnore;
exports.isPrettierIgnoreAttributeNode = isPrettierIgnoreAttributeNode;
exports.forceNextEmptyLine = forceNextEmptyLine;
exports.forceBreakContent = forceBreakContent;
exports.forceBreakChildren = forceBreakChildren;
exports.preferHardlineAsSurroundingSpaces = preferHardlineAsSurroundingSpaces;
exports.preferHardlineAsLeadingSpaces = preferHardlineAsLeadingSpaces;
exports.preferHardlineAsTrailingSpaces = preferHardlineAsTrailingSpaces;
exports.hasMeaningfulLackOfLeadingWhitespace = hasMeaningfulLackOfLeadingWhitespace;
exports.hasMeaningfulLackOfTrailingWhitespace = hasMeaningfulLackOfTrailingWhitespace;
exports.hasMeaningfulLackOfDanglingWhitespace = hasMeaningfulLackOfDanglingWhitespace;
exports.getLastDescendant = getLastDescendant;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const array_1 = require("./array");
function isScriptLikeTag(node) {
    return node.type === liquid_html_parser_1.NodeTypes.HtmlRawNode;
}
function isPreLikeNode(node) {
    return node.cssWhitespace.startsWith('pre');
}
// A bit like self-closing except we distinguish between them.
// Comments are also considered self-closing.
function hasNoCloseMarker(node) {
    return hasNoChildren(node) || isHtmlDanglingMarkerOpen(node);
}
function hasNoChildren(node) {
    return (isSelfClosing(node) ||
        isVoidElement(node) ||
        isHtmlComment(node) ||
        isHtmlDanglingMarkerClose(node));
}
function isHtmlDanglingMarkerOpen(node) {
    return (node.type === liquid_html_parser_1.NodeTypes.HtmlElement && node.blockEndPosition.start === node.blockEndPosition.end);
}
function isHtmlDanglingMarkerClose(node) {
    return node.type === liquid_html_parser_1.NodeTypes.HtmlDanglingMarkerClose;
}
function isHtmlComment(node) {
    return node.type === liquid_html_parser_1.NodeTypes.HtmlComment;
}
function isSelfClosing(node) {
    return node.type === liquid_html_parser_1.NodeTypes.HtmlSelfClosingElement;
}
function isVoidElement(node) {
    return node.type === liquid_html_parser_1.NodeTypes.HtmlVoidElement;
}
function isHtmlElement(node) {
    return node.type === liquid_html_parser_1.NodeTypes.HtmlElement;
}
function isTextLikeNode(node) {
    return !!node && node.type === liquid_html_parser_1.NodeTypes.TextNode;
}
function isLiquidNode(node) {
    return !!node && liquid_html_parser_1.LiquidNodeTypes.includes(node.type);
}
function isMultilineLiquidTag(node) {
    return !!node && node.type === liquid_html_parser_1.NodeTypes.LiquidTag && !!node.children && !(0, array_1.isEmpty)(node.children);
}
function isHtmlNode(node) {
    return !!node && liquid_html_parser_1.HtmlNodeTypes.includes(node.type);
}
function isAttributeNode(node) {
    return (isHtmlNode(node.parentNode) &&
        'attributes' in node.parentNode &&
        node.parentNode.attributes.indexOf(node) !== -1);
}
function hasNonTextChild(node) {
    return (node.children &&
        node.children.some((child) => child.type !== liquid_html_parser_1.NodeTypes.TextNode));
}
function shouldPreserveContent(node) {
    // // unterminated node in ie conditional comment
    // // e.g. <!--[if lt IE 9]><html><![endif]-->
    // if (
    //   node.type === "ieConditionalComment" &&
    //   node.lastChild &&
    //   !node.lastChild.isSelfClosing &&
    //   !node.lastChild.endSourceSpan
    // ) {
    //   return true;
    // }
    // // incomplete html in ie conditional comment
    // // e.g. <!--[if lt IE 9]></div><![endif]-->
    // if (node.type === "ieConditionalComment" && !node.complete) {
    //   return true;
    // }
    // TODO: Handle pre correctly?
    if (isPreLikeNode(node)) {
        return true;
    }
    return false;
}
function isPrettierIgnoreHtmlNode(node) {
    return (!!node && node.type === liquid_html_parser_1.NodeTypes.HtmlComment && /^\s*prettier-ignore(?=\s|$)/m.test(node.body));
}
function isPrettierIgnoreLiquidNode(node) {
    return (!!node &&
        node.type === liquid_html_parser_1.NodeTypes.LiquidTag &&
        node.name === '#' &&
        /^\s*prettier-ignore(?=\s|$)/m.test(node.markup));
}
function isPrettierIgnoreNode(node) {
    return isPrettierIgnoreLiquidNode(node) || isPrettierIgnoreHtmlNode(node);
}
function hasPrettierIgnore(node) {
    return isPrettierIgnoreNode(node) || isPrettierIgnoreNode(node.prev);
}
function getPrettierIgnoreAttributeCommentData(value) {
    const match = value.trim().match(/prettier-ignore-attribute(?:s?)(?:\s+(.+))?$/s);
    if (!match) {
        return false;
    }
    if (!match[1]) {
        return true;
    }
    // TODO We should support 'prettier-ignore-attribute a,b,c' and allow users to not
    // format the insides of some attributes.
    //
    // But since we don't reformat the insides of attributes yet (because of
    // issue #4), that feature doesn't really make sense.
    //
    // For now, we'll only support `prettier-ignore-attribute`
    //
    // https://github.com/Shopify/prettier-plugin-liquid/issues/4
    //
    // return match[1].split(/\s+/);
    return true;
}
function isPrettierIgnoreAttributeNode(node) {
    if (!node)
        return false;
    if (node.type === liquid_html_parser_1.NodeTypes.HtmlComment) {
        return getPrettierIgnoreAttributeCommentData(node.body);
    }
    if (node.type === liquid_html_parser_1.NodeTypes.LiquidTag && node.name === '#') {
        return getPrettierIgnoreAttributeCommentData(node.markup);
    }
    return false;
}
function forceNextEmptyLine(node) {
    if (!node)
        return false;
    if (!node.next)
        return false;
    const source = node.source;
    // Current implementation: force next empty line when two consecutive
    // lines exist between nodes.
    let tmp;
    tmp = source.indexOf('\n', node.position.end);
    if (tmp === -1)
        return false;
    tmp = source.indexOf('\n', tmp + 1);
    if (tmp === -1)
        return false;
    return tmp < node.next.position.start;
}
/** firstChild leadingSpaces and lastChild trailingSpaces */
function forceBreakContent(node) {
    return (forceBreakChildren(node) ||
        (node.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
            node.children.length > 0 &&
            (isTagNameIncluded(['body', 'script', 'style'], node.name) ||
                node.children.some((child) => hasNonTextChild(child)))) ||
        (node.firstChild &&
            node.firstChild === node.lastChild &&
            node.firstChild.type !== liquid_html_parser_1.NodeTypes.TextNode &&
            hasLeadingLineBreak(node.firstChild) &&
            (!node.lastChild.isTrailingWhitespaceSensitive || hasTrailingLineBreak(node.lastChild))));
}
/** spaces between children */
function forceBreakChildren(node) {
    return (node.type === liquid_html_parser_1.NodeTypes.HtmlElement &&
        node.children.length > 0 &&
        (isTagNameIncluded(['html', 'head', 'ul', 'ol', 'select'], node.name) ||
            (node.cssDisplay.startsWith('table') && node.cssDisplay !== 'table-cell')));
}
function preferHardlineAsSurroundingSpaces(node) {
    switch (node.type) {
        // case 'ieConditionalComment':
        case liquid_html_parser_1.NodeTypes.HtmlComment:
            return true;
        case liquid_html_parser_1.NodeTypes.HtmlElement:
            return isTagNameIncluded(['script', 'select'], node.name);
        case liquid_html_parser_1.NodeTypes.LiquidTag:
            if ((node.prev && isTextLikeNode(node.prev)) || (node.next && isTextLikeNode(node.next))) {
                return false;
            }
            return node.children && node.children.length > 0;
    }
    return false;
}
function preferHardlineAsLeadingSpaces(node) {
    return (preferHardlineAsSurroundingSpaces(node) ||
        (isLiquidNode(node) && node.prev && isLiquidNode(node.prev)) ||
        (node.prev && preferHardlineAsTrailingSpaces(node.prev)) ||
        hasSurroundingLineBreak(node));
}
function preferHardlineAsTrailingSpaces(node) {
    return (preferHardlineAsSurroundingSpaces(node) ||
        (isLiquidNode(node) && node.next && (isLiquidNode(node.next) || isHtmlNode(node.next))) ||
        (node.type === liquid_html_parser_1.NodeTypes.HtmlElement && isTagNameIncluded(['br'], node.name)) ||
        hasSurroundingLineBreak(node));
}
function hasMeaningfulLackOfLeadingWhitespace(node) {
    return node.isLeadingWhitespaceSensitive && !node.hasLeadingWhitespace;
}
function hasMeaningfulLackOfTrailingWhitespace(node) {
    return node.isTrailingWhitespaceSensitive && !node.hasTrailingWhitespace;
}
function hasMeaningfulLackOfDanglingWhitespace(node) {
    return node.isDanglingWhitespaceSensitive && !node.hasDanglingWhitespace;
}
function hasSurroundingLineBreak(node) {
    return hasLeadingLineBreak(node) && hasTrailingLineBreak(node);
}
function hasLeadingLineBreak(node) {
    if (node.type === liquid_html_parser_1.NodeTypes.Document)
        return false;
    return (node.hasLeadingWhitespace &&
        hasLineBreakInRange(node.source, node.prev
            ? node.prev.position.end
            : node.parentNode.blockStartPosition
                ? node.parentNode.blockStartPosition.end
                : node.parentNode.position.start, node.position.start));
}
function hasTrailingLineBreak(node) {
    if (node.type === liquid_html_parser_1.NodeTypes.Document)
        return false;
    return (node.hasTrailingWhitespace &&
        hasLineBreakInRange(node.source, node.position.end, node.next
            ? node.next.position.start
            : node.parentNode.blockEndPosition
                ? node.parentNode.blockEndPosition.start
                : node.parentNode.position.end));
}
function hasLineBreakInRange(source, start, end) {
    const index = source.indexOf('\n', start);
    return index !== -1 && index < end;
}
function getLastDescendant(node) {
    return node.lastChild ? getLastDescendant(node.lastChild) : node;
}
function isTagNameIncluded(collection, name) {
    if (name.length !== 1 || name[0].type !== liquid_html_parser_1.NodeTypes.TextNode)
        return false;
    return collection.includes(name[0].value);
}
//# sourceMappingURL=node.js.map