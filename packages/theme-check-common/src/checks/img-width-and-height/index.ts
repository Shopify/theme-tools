import { Severity, SourceCodeType, LiquidCheckDefinition } from '../../types';
import { isAttr, isValuedHtmlAttribute, ValuedHtmlAttribute } from '../utils';

export const ImgWidthAndHeight: LiquidCheckDefinition = {
  meta: {
    code: 'ImgWidthAndHeight',
    name: 'Width and height attributes on image tags',
    docs: {
      description:
        'This check is aimed at eliminating content layout shift in themes by enforcing the use of the width and height attributes on img tags.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/img-width-and-height',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async HtmlVoidElement(node) {
        if (node.name === 'img') {
          const widthAttr = node.attributes.find(
            (attr) => isValuedHtmlAttribute(attr) && isAttr(attr, 'width'),
          ) as ValuedHtmlAttribute | undefined;

          const heightAttr = node.attributes.find(
            (attr) => isValuedHtmlAttribute(attr) && isAttr(attr, 'height'),
          ) as ValuedHtmlAttribute | undefined;

          let missingAttributes = [];
          if (!widthAttr) {
            missingAttributes.push('width');
          }
          if (!heightAttr) {
            missingAttributes.push('height');
          }

          if (missingAttributes.length > 0) {
            const attributeWord = missingAttributes.length === 1 ? 'attribute' : 'attributes';
            context.report({
              message: `Missing ${missingAttributes.join(' and ')} ${attributeWord} on img tag`,
              startIndex: node.position.start,
              endIndex: node.position.end,
            });
          }
        }
      },
    };
  },
};
