import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import { isAttr, isValuedHtmlAttribute, ValuedHtmlAttribute, valueIncludes } from '../utils';

export const DeprecateBgsizes: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecateBgsizes',
    name: 'Deprecate Bgsizes',
    docs: {
      description: 'This check is aimed at discouraging the use of the lazySizes bgset plugin.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecate-bgsizes',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async HtmlElement(node) {
        const classAttributeWithLazyload: ValuedHtmlAttribute | undefined = node.attributes
          .filter(isValuedHtmlAttribute)
          .find((attr) => isAttr(attr, 'class') && valueIncludes(attr, 'lazyload'));

        if (classAttributeWithLazyload) {
          const attr = classAttributeWithLazyload;
          context.report({
            message: 'Use the native loading="lazy" attribute instead of lazysizes',
            startIndex: attr.attributePosition.start,
            endIndex: attr.attributePosition.end,
          });
        }

        const dataBgsetAttr = node.attributes.find(
          (attr) => isValuedHtmlAttribute(attr) && isAttr(attr, 'data-bgset'),
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
