import {
  LiquidHtmlNode,
  LiquidHtmlNodeTypes as NodeTypes,
  LiquidHtmlNodeOfType as NodeOfType,
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
} from '../../types';

type AttrSingleQuoted = NodeOfType<NodeTypes.AttrSingleQuoted>;
type AttrDoubleQuoted = NodeOfType<NodeTypes.AttrDoubleQuoted>;
type AttrUnquoted = NodeOfType<NodeTypes.AttrUnquoted>;
type HtmlElement = NodeOfType<NodeTypes.HtmlElement>;
type TextNode = NodeOfType<NodeTypes.TextNode>;
type ValuedHtmlAttribute = AttrUnquoted | AttrDoubleQuoted | AttrSingleQuoted;
type ElementType<T> = T extends (infer E)[] ? E : never;

function isAttributeNode(
  attr: ElementType<HtmlElement['attributes']>,
): attr is ValuedHtmlAttribute {
  return [NodeTypes.AttrUnquoted, NodeTypes.AttrDoubleQuoted, NodeTypes.AttrSingleQuoted].some(
    (type) => isNodeOfType(type, attr),
  );
}

function isNodeOfType<T extends NodeTypes>(type: T, node: LiquidHtmlNode): node is NodeOfType<T> {
  return node.type === type;
}

function isAttr(name: string, attr: ValuedHtmlAttribute) {
  return (
    attr.name.length === 1 &&
    isNodeOfType(NodeTypes.TextNode, attr.name[0]) &&
    attr.name[0].value === name
  );
}

function valueIncludes(word: string, attr: ValuedHtmlAttribute) {
  const regex = new RegExp(`(^|\\s)${word}(\\s|$)`, 'g');

  return attr.value
    .filter((node): node is TextNode => isNodeOfType(NodeTypes.TextNode, node))
    .some((valueNode) => regex.test(valueNode.value));
}

export const DeprecateBgsizes: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecateBgsizes',
    name: 'Deprecate Bgsizes',
    docs: {
      description: 'This check is aimed at discouraging the use of the lazySizes bgset plugin.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async HtmlElement(node) {
        const classAttributeWithLazyload = node.attributes.find(
          (attr) =>
            isAttributeNode(attr) && isAttr('class', attr) && valueIncludes('lazyload', attr),
        ) as ValuedHtmlAttribute | undefined;

        if (classAttributeWithLazyload) {
          const attr = classAttributeWithLazyload;
          context.report({
            message: 'Use the native loading="lazy" attribute instead of lazysizes',
            startIndex: attr.attributePosition.start,
            endIndex: attr.attributePosition.end,
          });
        }

        const dataBgsetAttr = node.attributes.find(
          (attr) => isAttributeNode(attr) && isAttr('data-bgset', attr),
        ) as ValuedHtmlAttribute | undefined;

        if (dataBgsetAttr) {
          context.report({
            message: 'Use the CSS imageset attribute instead of data-bgset',
            startIndex: dataBgsetAttr.position.start,
            endIndex: dataBgsetAttr.position.end,
          });
        }
      },
    };
  },
};
