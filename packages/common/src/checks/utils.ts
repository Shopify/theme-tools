import { Position } from '@shopify/prettier-plugin-liquid/dist/types';
import {
  LiquidHtmlNode,
  LiquidHtmlNodeTypes as NodeTypes,
  LiquidHtmlNodeOfType as NodeOfType,
} from '../types';

type HtmlElement = NodeOfType<NodeTypes.HtmlElement>;
type TextNode = NodeOfType<NodeTypes.TextNode>;
type ElementType<T> = T extends (infer E)[] ? E : never;

export type AttrEmpty = NodeOfType<NodeTypes.AttrEmpty>;
export type ValuedHtmlAttribute =
  | NodeOfType<NodeTypes.AttrSingleQuoted>
  | NodeOfType<NodeTypes.AttrDoubleQuoted>
  | NodeOfType<NodeTypes.AttrUnquoted>;

export function isNodeOfType<T extends NodeTypes>(
  type: T,
  node: LiquidHtmlNode,
): node is NodeOfType<T> {
  return node.type === type;
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
