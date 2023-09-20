import { AttrEmpty, LiquidHtmlNode, NodeTypes, TextNode } from '@shopify/liquid-html-parser';
import { LiquidHtmlNodeOfType as NodeOfType } from '@shopify/theme-check-common';

export type HtmlElementTypes = (typeof HtmlElementTypes)[number];
export const HtmlElementTypes = [
  NodeTypes.HtmlElement,
  NodeTypes.HtmlDanglingMarkerOpen,
  NodeTypes.HtmlDanglingMarkerClose,
  NodeTypes.HtmlSelfClosingElement,
  NodeTypes.HtmlVoidElement,
  NodeTypes.HtmlRawNode,
] as const;
export type NamedHtmlElementNode = NodeOfType<HtmlElementTypes>;

export type HtmlAttributeTypes = (typeof HtmlAttributeTypes)[number];
export type HtmlAttribute = NodeOfType<HtmlAttributeTypes>;
export const HtmlAttributeTypes = [
  NodeTypes.AttrUnquoted,
  NodeTypes.AttrDoubleQuoted,
  NodeTypes.AttrSingleQuoted,
  NodeTypes.AttrEmpty,
] as const;

export function isTextNode(node: LiquidHtmlNode): node is TextNode {
  return node.type === NodeTypes.TextNode;
}

export function isAttrEmpty(node: LiquidHtmlNode): node is AttrEmpty {
  return node.type === NodeTypes.AttrEmpty;
}

export function isNamedHtmlElementNode(node: LiquidHtmlNode): node is NamedHtmlElementNode {
  return (HtmlElementTypes as readonly NodeTypes[]).includes(node.type);
}

export function getCompoundName(node: NamedHtmlElementNode | HtmlAttribute): string {
  if (typeof node.name === 'string') return node.name;

  const names = node.name;
  if (names.length === 0 || names.length > 1 || !isTextNode(names[0])) {
    return 'unknown';
  }

  return names[0].value;
}

export function isHtmlAttribute(node: LiquidHtmlNode): node is HtmlAttribute {
  return HtmlAttributeTypes.some((type) => node.type === type);
}
