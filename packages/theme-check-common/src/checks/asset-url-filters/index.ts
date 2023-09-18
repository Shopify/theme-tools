import {
  HtmlRawNode,
  HtmlVoidElement,
} from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import {
  LiquidHtmlNodeTypes as NodeTypes,
  LiquidHtmlNodeOfType as NodeOfType,
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
  LiquidHtmlNode,
} from '../../types';
import { isAttr, isValuedHtmlAttribute, isNodeOfType, ValuedHtmlAttribute } from '../utils';
import { last } from '../../utils';

const TAGNAMES = ['stylesheet_tag', 'script_tag', 'image_tag', 'img_tag'];
const DEPRECATED = ['product_img_url', 'article_img_url', 'collection_img_url', 'img_url'];
const NON_DEPRECATED = [
  'asset_url',
  'image_url',
  'asset_img_url',
  'file_img_url',
  'file_url',
  'global_asset_url',
  'shopify_asset_url',
  'external_video_url',
];
const LIQUID_OBJECT = 'canonical_url';

function valueIsShopifyHosted(attr: ValuedHtmlAttribute): boolean {
  const ASSET_URL_FILTER_NAMES = [...DEPRECATED, ...NON_DEPRECATED];
  const ASSET_URL_OBJECT_NAMES = [LIQUID_OBJECT];

  return attr.value.some((node) => {
    if (!isNodeOfType(NodeTypes.LiquidVariableOutput, node)) return false;
    if (typeof node.markup === 'string') return false;
    if (!isNodeOfType(NodeTypes.LiquidVariable, node.markup)) return false;

    const includesFilter = node.markup.filters.some((filter) =>
      ASSET_URL_FILTER_NAMES.includes(filter.name),
    );
    if (includesFilter) return true;

    if (!isNodeOfType(NodeTypes.VariableLookup, node.markup.expression)) return false;
    return node.markup.expression.name
      ? ASSET_URL_OBJECT_NAMES.includes(node.markup.expression.name)
      : false;
  });
}

export const AssetUrlFilters: LiquidCheckDefinition = {
  meta: {
    code: 'AssetUrlFilters',
    name: 'Asset URL Filters',
    docs: {
      description: 'This check is aimed at eliminating unnecessary HTTP connections.',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/asset-url-filters',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function checkNode(node: HtmlVoidElement | HtmlRawNode) {
      const urlAttribute: ValuedHtmlAttribute | undefined = node.attributes
        .filter(isValuedHtmlAttribute)
        .find((attr) => isAttr(attr, 'src') || isAttr(attr, 'href'));

      if (!urlAttribute) return;

      const hasShopifyHostedValue = valueIsShopifyHosted(urlAttribute);

      if (hasShopifyHostedValue) return;

      context.report({
        message: 'Use one of the asset_url filters to serve assets for better performance',
        startIndex: urlAttribute.position.start,
        endIndex: urlAttribute.position.end,
      });
    }

    function checkLiquidFilter(
      node: NodeOfType<NodeTypes.LiquidFilter>,
      ancestors: LiquidHtmlNode[],
    ) {
      const tagName = node.name;

      if (!TAGNAMES.includes(tagName)) return;

      const parentNode = last(ancestors);
      if (!parentNode || !isNodeOfType(NodeTypes.LiquidVariable, parentNode)) return;

      const hasAsset = parentNode.filters.some(
        (filter: { name: string }) =>
          DEPRECATED.includes(filter.name) || NON_DEPRECATED.includes(filter.name),
      );

      if (hasAsset) return;

      context.report({
        message: `Use one of the asset_url filters to serve assets for better performance`,
        startIndex: parentNode.expression.position.start,
        endIndex: node.position.end,
      });
    }

    return {
      async HtmlVoidElement(node) {
        checkNode(node);
      },
      async HtmlRawNode(node) {
        checkNode(node);
      },
      async LiquidFilter(node, ancestors) {
        checkLiquidFilter(node, ancestors);
      },
    };
  },
};
