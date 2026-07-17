import {
  Position,
  NodeTypes,
  HtmlElement,
  HtmlSelfClosingElement,
  HtmlVoidElement,
  HtmlRawNode,
  TextNode,
  AttrEmpty,
  AttrSingleQuoted,
  AttrDoubleQuoted,
  AttrUnquoted,
  LiquidHtmlNode,
  LiquidBranch,
  LiquidTagFor,
  LiquidTagTablerow,
  LiquidTag,
  LoopNamedTags,
} from '@shopify/liquid-html-parser';
import { LiquidHtmlNodeOfType as NodeOfType } from '../types';

type ElementType<T> = T extends (infer E)[] ? E : never;

export type ValuedHtmlAttribute = AttrSingleQuoted | AttrDoubleQuoted | AttrUnquoted;

export function isNodeOfType<T extends NodeTypes>(
  type: T,
  node?: LiquidHtmlNode,
): node is NodeOfType<T> {
  return node?.type === type;
}

export function isLiquidBranch(node: LiquidHtmlNode): node is LiquidBranch {
  return isNodeOfType(NodeTypes.LiquidBranch, node);
}

/**
 * Returns the static tag name of an HTML node as a string.
 *
 * Void and raw nodes (`<img>`, `<script>`, …) carry a plain string name.
 * General and self-closing elements carry a compound name (an array of
 * segments) because the tag name can include Liquid, e.g.
 * `<{{ header_type }}--header />`. Only a single TextNode segment resolves to
 * a static string; anything dynamic returns undefined.
 */
export function getHtmlNodeName(
  node: HtmlElement | HtmlSelfClosingElement | HtmlVoidElement | HtmlRawNode,
): string | undefined {
  if (typeof node.name === 'string') return node.name;
  if (node.name.length === 1 && isNodeOfType(NodeTypes.TextNode, node.name[0])) {
    return node.name[0].value;
  }
  return undefined;
}

export function isHtmlTag<T>(
  node: HtmlElement,
  name: T,
): node is HtmlElement & { name: [{ name: T }]; blockEndPosition: Position } {
  return (
    node.name.length === 1 &&
    node.name[0].type === NodeTypes.TextNode &&
    node.name[0].value === name &&
    !!node.blockEndPosition
  );
}

export function isAttr(attr: ValuedHtmlAttribute | AttrEmpty, name: string) {
  return (
    attr.name.length === 1 &&
    isNodeOfType(NodeTypes.TextNode, attr.name[0]) &&
    attr.name[0].value === name
  );
}

export function isHtmlAttribute(
  attr: ElementType<HtmlElement['attributes']>,
): attr is ValuedHtmlAttribute | AttrEmpty {
  return [
    NodeTypes.AttrUnquoted,
    NodeTypes.AttrDoubleQuoted,
    NodeTypes.AttrSingleQuoted,
    NodeTypes.AttrEmpty,
  ].some((type) => isNodeOfType(type, attr));
}

export function isValuedHtmlAttribute(
  attr: ElementType<HtmlElement['attributes']>,
): attr is ValuedHtmlAttribute {
  return [NodeTypes.AttrUnquoted, NodeTypes.AttrDoubleQuoted, NodeTypes.AttrSingleQuoted].some(
    (type) => isNodeOfType(type, attr),
  );
}

export function valueIncludes(attr: ValuedHtmlAttribute, word: string) {
  const regex = new RegExp(`(^|\\s)${word}(\\s|$)`, 'g');

  return attr.value
    .filter((node): node is TextNode => isNodeOfType(NodeTypes.TextNode, node))
    .some((valueNode) => regex.test(valueNode.value));
}

export function hasAttributeValueOf(attr: ValuedHtmlAttribute, value: string) {
  return (
    attr.value.length === 1 &&
    isNodeOfType(NodeTypes.TextNode, attr.value[0]) &&
    attr.value[0].value === value
  );
}

export function isLiquidString(node: LiquidHtmlNode): node is NodeOfType<NodeTypes.String> {
  return node.type === NodeTypes.String;
}

export function isLoopScopedVariable(variableName: string, ancestors: LiquidHtmlNode[]) {
  return ancestors.some(
    (ancestor) =>
      ancestor.type === NodeTypes.LiquidTag &&
      isLoopLiquidTag(ancestor) &&
      typeof ancestor.markup !== 'string' &&
      ancestor.markup.variableName === variableName,
  );
}

export function isLoopLiquidTag(tag: LiquidTag): tag is LiquidTagFor | LiquidTagTablerow {
  return LoopNamedTags.includes(tag.name as any);
}

const RawTagsThatDoNotParseTheirContents = ['raw', 'stylesheet', 'javascript', 'schema'];

function isRawTagThatDoesNotParseItsContent(node: LiquidHtmlNode) {
  return (
    node.type === NodeTypes.LiquidRawTag && RawTagsThatDoNotParseTheirContents.includes(node.name)
  );
}

export function isWithinRawTagThatDoesNotParseItsContents(ancestors: LiquidHtmlNode[]) {
  return ancestors.some(isRawTagThatDoesNotParseItsContent);
}
