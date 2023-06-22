import { HtmlVoidElement } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import {
  LiquidHtmlNodeTypes as NodeTypes,
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
} from '../../types';
import { isAttr, isValuedHtmlAttribute, isNodeOfType, ValuedHtmlAttribute } from '../utils';

function getLoadingAttribute(node: HtmlVoidElement): ValuedHtmlAttribute {
  return node.attributes.find(
    (attr) => isValuedHtmlAttribute(attr) && isAttr(attr, 'loading'),
  ) as ValuedHtmlAttribute;
}

function getLoadingValue(loadingAttribute: ValuedHtmlAttribute): string | null {
  if (loadingAttribute) {
    const valueNode = loadingAttribute.value.find((node) => isNodeOfType(NodeTypes.TextNode, node));
    if (valueNode && isNodeOfType(NodeTypes.TextNode, valueNode)) {
      return valueNode.value;
    }
  }

  return null;
}

export const ImgLazyLoading: LiquidCheckDefinition = {
  meta: {
    code: 'ImgLazyLoading',
    name: 'Img Lazy Loading',
    docs: {
      description: 'This check is aimed at encouraging the use of the native loading attribute.',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/img-lazy-loading',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async HtmlVoidElement(node) {
        if (node.name !== 'img') return;

        const loadingAttr = getLoadingAttribute(node);
        const loadingValue = getLoadingValue(loadingAttr);

        if (!loadingValue) {
          context.report({
            message: 'Improve performance by using loading="eager" or loading="lazy".',
            startIndex: node.position.start,
            endIndex: node.position.end,
            suggest: [
              {
                message: 'Add loading="lazy" for below the fold content',
                fix: (corrector) => {
                  corrector.insert(node.position.end - 1, ' loading="lazy"');
                },
              },
              {
                message: 'Add loading="eager" for above the fold content',
                fix: (corrector) => {
                  corrector.insert(node.position.end - 1, ' loading="eager"');
                },
              },
            ],
          });
          return;
        }

        if (loadingValue === 'auto') {
          const valueNode = loadingAttr.value.find((node) =>
            isNodeOfType(NodeTypes.TextNode, node),
          );

          context.report({
            message:
              'The loading="auto" attribute is deprecated, use loading="lazy" or loading="eager" instead.',
            startIndex: loadingAttr.position.start,
            endIndex: loadingAttr.position.end,
            suggest: [
              {
                message: 'Replace with loading="lazy"',
                fix: (corrector) => {
                  if (valueNode) {
                    corrector.replace(valueNode.position.start, valueNode.position.end, 'lazy');
                  }
                },
              },
              {
                message: 'Replace with loading="eager"',
                fix: (corrector) => {
                  if (valueNode) {
                    corrector.replace(valueNode.position.start, valueNode.position.end, 'eager');
                  }
                },
              },
            ],
          });
        }
      },
    };
  },
};
