import { ConfigTarget, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const MissingSchema: LiquidCheckDefinition = {
  meta: {
    code: 'MissingSchema',
    name: 'Missing schema definitions in theme app extensions should be avoided',
    docs: {
      description: 'Report missing schema definitions in theme app extensions',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-schema',
    },
    severity: Severity.ERROR,
    type: SourceCodeType.LiquidHtml,
    schema: {},
    targets: [ConfigTarget.ThemeAppExtension],
  },

  create(context) {
    let foundSchema = false;

    return {
      async LiquidRawTag(node) {
        if (node.name == 'schema') foundSchema = true;
      },

      async onCodePathEnd() {
        if (!foundSchema) {
          context.report({
            message: `The schema does not exist`,
            startIndex: 0,
            endIndex: 0,
          });
        }
      },
    };
  },
};
