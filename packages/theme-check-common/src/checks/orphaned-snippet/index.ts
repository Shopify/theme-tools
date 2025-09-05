import { isSnippet } from '../../to-schema';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';

export const OrphanedSnippet: LiquidCheckDefinition = {
  meta: {
    code: 'OrphanedSnippet',
    name: 'Prevent orphaned snippets',
    docs: {
      description: 'This check exists to prevent orphaned snippets in themes.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/orphaned-snippet',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async onCodePathEnd() {
        const { getReferences } = context;

        if (!getReferences) {
          return;
        }

        const fileUri = context.file.uri;
        if (isSnippet(fileUri)) {
          const references = await getReferences(fileUri);

          if (references.length === 0) {
            context.report({
              message: `This snippet is not referenced by any other files`,
              startIndex: 0,
              endIndex: 1,
            });
          }
        }
      },
    };
  },
};
