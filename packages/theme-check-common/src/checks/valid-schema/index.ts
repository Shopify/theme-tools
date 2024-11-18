import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const ValidSchema: LiquidCheckDefinition = {
  meta: {
    code: 'ValidSchema',
    name: 'Prevent invalid JSON in {% schema %} tags',
    docs: {
      description: 'This check is aimed at eliminating JSON errors in schema tags.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json' || !context.validateJSON) {
          return;
        }
        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );
        const problems = await context.validateJSON(context.file.uri, jsonString);
        if (!problems) return;

        for (const problem of problems) {
          context.report({
            message: problem.message,
            startIndex: node.blockStartPosition.end + problem.startIndex,
            endIndex: node.blockStartPosition.end + problem.endIndex,
          });
        }
      },
    };
  },
};
