import { TextNode } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const ValidDocParamNames: LiquidCheckDefinition = {
  meta: {
    code: 'ValidDocParamNames',
    name: 'Valid doc parameter names',
    docs: {
      description:
        'This check exists to ensure any parameter names defined in LiquidDoc do not collide with reserved words.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-doc-param-names',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const tagsPromise = context.themeDocset?.tags();
    const objectsPromise = context.themeDocset?.objects();

    return {
      async LiquidDocParamNode(node) {
        const paramName = node.paramName.value;

        const tags = (await tagsPromise)?.map((tag) => tag.name) || [];
        const objects = (await objectsPromise)?.map((obj) => obj.name) || [];

        if (tags.includes(paramName)) {
          reportWarning(
            context,
            `The parameter '${paramName}' shares the same name with a liquid tag.`,
            node.paramName,
          );
        }

        if (objects.includes(paramName)) {
          reportWarning(
            context,
            `The parameter '${paramName}' shares the same name with a global liquid object.`,
            node.paramName,
          );
        }
      },
    };
  },
};

function reportWarning(context: any, message: string, node: TextNode) {
  context.report({
    message,
    startIndex: node.position.start,
    endIndex: node.position.end,
  });
}
