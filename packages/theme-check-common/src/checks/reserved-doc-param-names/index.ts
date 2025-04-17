import { TextNode } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isBlock } from '../../to-schema';
import { CONTENT_FOR_BLOCK_PARAMETERS } from '../../tags/content-for';

export const ReservedDocParamNames: LiquidCheckDefinition = {
  meta: {
    code: 'ReservedDocParamNames',
    name: 'Valid doc parameter names',
    docs: {
      description:
        'This check exists to ensure any parameter names defined in LiquidDoc do not collide with reserved words.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/reserved-doc-param-names',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    if (!isBlock(context.file.uri)) {
      return {};
    }

    const defaultParameterNames = Object.keys(CONTENT_FOR_BLOCK_PARAMETERS);

    return {
      async LiquidDocParamNode(node) {
        const paramName = node.paramName.value;

        if (defaultParameterNames.includes(paramName)) {
          reportWarning(
            context,
            `The parameter name can't share the same name as a 'content_for' tag parameter: ${defaultParameterNames
              .map((name) => `'${name}'`)
              .join(', ')}`,
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
