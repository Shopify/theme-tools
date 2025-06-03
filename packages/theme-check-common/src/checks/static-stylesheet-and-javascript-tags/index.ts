import { NodeTypes } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const StaticStylesheetAndJavascriptTags: LiquidCheckDefinition = {
  meta: {
    code: 'StaticStylesheetAndJavascriptTags',
    name: 'Reports non static stylesheet and javascript tags',
    docs: {
      description:
        'Reports the usage of Liquid within {% stylesheet %} and {% javascript %} tags, which should only contain static content.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/static-stylesheet-and-javascript-tags',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'stylesheet' && node.name !== 'javascript') {
          return;
        }

        const liquidNodes = node.body.nodes.filter(
          (childNode) =>
            childNode.type === NodeTypes.LiquidVariableOutput ||
            childNode.type === NodeTypes.LiquidTag ||
            childNode.type === NodeTypes.LiquidRawTag,
        );

        for (const liquidNode of liquidNodes) {
          const tagType = node.name === 'stylesheet' ? 'CSS' : 'JavaScript';
          const liquidType =
            liquidNode.type === NodeTypes.LiquidVariableOutput ? 'variable' : 'tag';

          context.report({
            message: `Liquid ${liquidType} found in ${tagType} block. {% ${node.name} %} tags should only contain static ${tagType} code.`,
            startIndex: liquidNode.position.start,
            endIndex: liquidNode.position.end,
          });
        }
      },
    };
  },
};
