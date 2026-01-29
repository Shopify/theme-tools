import { CSSValidator } from '../../CSSValidator';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

const cssValidator = CSSValidator.create();

export const ValidScopedStylesheetContent: LiquidCheckDefinition = {
  meta: {
    code: 'ValidScopedStylesheetContent',
    name: 'Enforce valid scoped stylesheet content',
    docs: {
      description: 'This check is aimed at ensuring a valid scoped stylesheet content.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-scoped-stylesheet-content',
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

        // First, validate CSS syntax
        const { root, problems: parseProblems } = cssValidator.validate(context.file.uri, styles);

        // If there are parse errors, skip CSS module validation
        // (don't report parse errors - let the browser/other tools handle those)
        if (parseProblems.length > 0 || !root) {
          return;
        }

        // Validate CSS module selector compliance
        const selectorProblems = cssValidator.validateCssModuleSelectors(root, styles);

        for (const problem of selectorProblems) {
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
