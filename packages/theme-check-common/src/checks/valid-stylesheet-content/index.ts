import { CSSValidator } from '../../CSSValidator';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

const cssValidator = CSSValidator.create();

export const ValidStylesheetContent: LiquidCheckDefinition = {
  meta: {
    code: 'ValidStylesheetContent',
    name: 'Enforce valid stylesheet content',
    docs: {
      description: 'This check validates CSS syntax within stylesheet tags.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-stylesheet-content',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'stylesheet') {
          return;
        }

        const styles = node.body.value;

        // Validate CSS syntax
        const { problems } = cssValidator.validate(context.file.uri, styles);

        for (const problem of problems) {
          context.report({
            message: problem.message,
            startIndex: node.body.position.start + problem.startIndex,
            endIndex: node.body.position.start + problem.endIndex,
          });
        }
      },
    };
  },
};
