import { HtmlSelfClosingElement, HtmlVoidElement } from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import { getHtmlNodeName, isAttr, isValuedHtmlAttribute, valueIncludes } from '../utils';

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
        .some((attr) => isAttr(attr, 'href') && valueIncludes(attr, '.+cdn.shopify.com.+'));

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
