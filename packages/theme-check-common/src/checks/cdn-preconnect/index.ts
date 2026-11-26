import { HtmlSelfClosingElement, HtmlVoidElement, NodeTypes } from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import {
  getHtmlNodeName,
  isAttr,
  isNodeOfType,
  isValuedHtmlAttribute,
  valueIncludes,
  ValuedHtmlAttribute,
} from '../utils';

export const CdnPreconnect: LiquidCheckDefinition = {
  meta: {
    code: 'CdnPreconnect',
    name: 'CDN Preconnect',
    docs: {
      description: "This check is aimed at signaling the redundant preconnect to Shopify's CDN",
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/cdn-preconnect',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    function checkNode(node: HtmlVoidElement | HtmlSelfClosingElement) {
      if (getHtmlNodeName(node) !== 'link') return;

      const isPreconnect = node.attributes
        .filter(isValuedHtmlAttribute)
        .some((attr) => isAttr(attr, 'rel') && valueIncludes(attr, 'preconnect'));

      if (!isPreconnect) return;

      const isShopifyCdn = node.attributes
        .filter(isValuedHtmlAttribute)
        .some((attr) => isAttr(attr, 'href') && isShopifyCdnUrl(attr));

      if (!isShopifyCdn) return;

      context.report({
        message:
          'Preconnecting to cdn.shopify.com is unnecessary and can lead to worse performance',
        startIndex: node.position.start,
        endIndex: node.position.end,
      });
    }

    return {
      async HtmlVoidElement(node) {
        checkNode(node);
      },
      async HtmlSelfClosingElement(node) {
        checkNode(node);
      },
    };
  },
};

const SHOPIFY_CDN_ORIGIN = /^(https?:)?\/\/cdn\.shopify\.com(:443)?/i;

/**
 * Whether the href points at the cdn.shopify.com origin. The URL must start
 * with the origin in static text, and the host must end there: at a path,
 * query or fragment, or at the end of the whole value.
 */
function isShopifyCdnUrl(attr: ValuedHtmlAttribute): boolean {
  const [first, ...rest] = attr.value;
  if (!first || !isNodeOfType(NodeTypes.TextNode, first)) return false;

  const url = first.value.trim();
  const origin = url.match(SHOPIFY_CDN_ORIGIN);
  if (!origin) return false;

  const afterOrigin = url.slice(origin[0].length);
  if (afterOrigin === '') return rest.length === 0;
  return /^[/?#]/.test(afterOrigin);
}
