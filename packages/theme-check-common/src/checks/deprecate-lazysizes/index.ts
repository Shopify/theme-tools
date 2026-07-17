import { HtmlSelfClosingElement, HtmlVoidElement } from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import {
  ValuedHtmlAttribute,
  getHtmlNodeName,
  isAttr,
  isValuedHtmlAttribute,
  isHtmlAttribute,
  valueIncludes,
} from '../utils';

function showsLazysizesUsage(attr: ValuedHtmlAttribute) {
  return isAttr(attr, 'data-srcset') || isAttr(attr, 'data-sizes');
}

export const DeprecateLazysizes: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecateLazysizes',
    name: 'Deprecate Lazysizes',
    docs: {
      description:
        'This check is aimed at discouraging the use of the lazysizes JavaScript library',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecate-lazysizes',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    function checkNode(node: HtmlVoidElement | HtmlSelfClosingElement) {
      if (getHtmlNodeName(node) !== 'img') return;

      const attributes = node.attributes.filter(isHtmlAttribute);
      const hasSrc = attributes.some((attr) => isAttr(attr, 'src'));
      const hasNativeLoading = attributes.some((attr) => isAttr(attr, 'loading'));
      if (hasSrc && hasNativeLoading) return;

      const hasLazyloadClass = node.attributes
        .filter(isValuedHtmlAttribute)
        .some((attr) => isAttr(attr, 'class') && valueIncludes(attr, 'lazyload'));
      if (!hasLazyloadClass) return;

      const hasLazysizesAttribute = node.attributes
        .filter(isValuedHtmlAttribute)
        .some(showsLazysizesUsage);
      if (!hasLazysizesAttribute) return;

      context.report({
        message: 'Use the native loading="lazy" attribute instead of lazysizes',
        startIndex: node.position.start,
        endIndex: node.position.end,
      });
    }

    return {
      async HtmlVoidElement(node) {
        checkNode(node);
      },
      // The ported parser emits `HtmlSelfClosingElement` for self-closed
      // void tags such as `<img … />`, whereas the previous parser emitted
      // `HtmlVoidElement` regardless of the trailing slash. Visit both so the
      // check still fires on self-closing markup.
      async HtmlSelfClosingElement(node) {
        checkNode(node);
      },
    };
  },
};
