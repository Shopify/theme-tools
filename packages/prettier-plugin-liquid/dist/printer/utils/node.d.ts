import { NodeTypes, Position } from '@shopify/liquid-html-parser';
import { HtmlSelfClosingElement, LiquidHtmlNode, TextNode, LiquidNode, HtmlNode, HtmlVoidElement, HtmlComment, HtmlElement, LiquidTag, AttributeNode, HtmlDanglingMarkerClose } from '../../types';
export declare function isScriptLikeTag(node: {
    type: NodeTypes;
}): boolean;
export declare function isPreLikeNode(node: {
    cssWhitespace: string;
}): boolean;
export declare function hasNoCloseMarker(node: LiquidHtmlNode): node is HtmlComment | HtmlVoidElement | HtmlSelfClosingElement | HtmlDanglingMarkerClose | HtmlElement;
export declare function hasNoChildren(node: LiquidHtmlNode): node is HtmlComment | HtmlVoidElement | HtmlSelfClosingElement | HtmlDanglingMarkerClose;
export declare function isHtmlDanglingMarkerOpen(node: LiquidHtmlNode): node is Omit<HtmlElement, 'blockEndPosition'> & {
    blockEndPosition: Position;
};
export declare function isHtmlDanglingMarkerClose(node: LiquidHtmlNode): node is HtmlDanglingMarkerClose;
export declare function isHtmlComment(node: LiquidHtmlNode): node is HtmlComment;
export declare function isSelfClosing(node: LiquidHtmlNode): node is HtmlSelfClosingElement;
export declare function isVoidElement(node: LiquidHtmlNode): node is HtmlVoidElement;
export declare function isHtmlElement(node: LiquidHtmlNode): node is HtmlElement;
export declare function isTextLikeNode(node: LiquidHtmlNode | undefined): node is TextNode;
export declare function isLiquidNode(node: LiquidHtmlNode | undefined): node is LiquidNode;
export declare function isMultilineLiquidTag(node: LiquidHtmlNode | undefined): node is LiquidTag;
export declare function isHtmlNode(node: LiquidHtmlNode | undefined): node is HtmlNode;
export declare function isAttributeNode(node: LiquidHtmlNode): node is AttributeNode & {
    parentNode: HtmlNode;
};
export declare function hasNonTextChild(node: LiquidHtmlNode): any;
export declare function shouldPreserveContent(node: LiquidHtmlNode): boolean;
export declare function isPrettierIgnoreHtmlNode(node: LiquidHtmlNode | undefined): node is HtmlComment;
export declare function isPrettierIgnoreLiquidNode(node: LiquidHtmlNode | undefined): node is LiquidTag;
export declare function isPrettierIgnoreNode(node: LiquidHtmlNode | undefined): node is HtmlComment | LiquidTag;
export declare function hasPrettierIgnore(node: LiquidHtmlNode): boolean;
export declare function isPrettierIgnoreAttributeNode(node: LiquidHtmlNode | undefined): boolean;
export declare function forceNextEmptyLine(node: LiquidHtmlNode | undefined): boolean;
/** firstChild leadingSpaces and lastChild trailingSpaces */
export declare function forceBreakContent(node: LiquidHtmlNode): boolean | undefined;
/** spaces between children */
export declare function forceBreakChildren(node: LiquidHtmlNode): boolean;
export declare function preferHardlineAsSurroundingSpaces(node: LiquidHtmlNode): boolean | undefined;
export declare function preferHardlineAsLeadingSpaces(node: LiquidHtmlNode): boolean;
export declare function preferHardlineAsTrailingSpaces(node: LiquidHtmlNode): boolean;
export declare function hasMeaningfulLackOfLeadingWhitespace(node: LiquidHtmlNode): boolean;
export declare function hasMeaningfulLackOfTrailingWhitespace(node: LiquidHtmlNode): boolean;
export declare function hasMeaningfulLackOfDanglingWhitespace(node: LiquidHtmlNode): boolean;
export declare function getLastDescendant(node: LiquidHtmlNode): LiquidHtmlNode;
