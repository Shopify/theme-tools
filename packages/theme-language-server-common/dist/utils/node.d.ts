import { AttrEmpty, LiquidHtmlNode, NamedTags, NodeTypes, TextNode } from '@shopify/liquid-html-parser';
import { LiquidHtmlNodeOfType as NodeOfType } from '@shopify/theme-check-common';
export type HtmlElementTypes = (typeof HtmlElementTypes)[number];
export declare const HtmlElementTypes: readonly [NodeTypes.HtmlElement, NodeTypes.HtmlDanglingMarkerClose, NodeTypes.HtmlSelfClosingElement, NodeTypes.HtmlVoidElement, NodeTypes.HtmlRawNode];
export type NamedHtmlElementNode = NodeOfType<HtmlElementTypes>;
export type HtmlAttributeTypes = (typeof HtmlAttributeTypes)[number];
export type HtmlAttribute = NodeOfType<HtmlAttributeTypes>;
export declare const HtmlAttributeTypes: readonly [NodeTypes.AttrUnquoted, NodeTypes.AttrDoubleQuoted, NodeTypes.AttrSingleQuoted, NodeTypes.AttrEmpty];
export declare function isTextNode(node: LiquidHtmlNode): node is TextNode;
export declare function isAttrEmpty(node: LiquidHtmlNode): node is AttrEmpty;
export declare function isNamedHtmlElementNode(node: LiquidHtmlNode): node is NamedHtmlElementNode;
export declare function getCompoundName(node: NamedHtmlElementNode | HtmlAttribute): string;
export declare function isHtmlAttribute(node: LiquidHtmlNode): node is HtmlAttribute;
type ExcludeStringMarkup<T> = T extends {
    markup: string;
} ? never : T;
export declare function isNamedLiquidTag<NT extends LiquidHtmlNode, T extends NamedTags>(node: LiquidHtmlNode, name: T): node is ExcludeStringMarkup<Extract<NT, {
    type: NodeTypes.LiquidTag;
    name: T;
}>>;
export declare function isLiquidVariableOutput<NT extends LiquidHtmlNode>(node: LiquidHtmlNode): node is ExcludeStringMarkup<Extract<NT, {
    type: NodeTypes.LiquidVariableOutput;
}>>;
export {};
