import { SourceCodeType, JSONCheckDefinition, Severity, Problem, JSONNode } from '../../types';
import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { Location, LiteralNode } from 'json-to-ast';

export const ValidHTMLTranslation: JSONCheckDefinition = {
  meta: {
    code: 'ValidHTMLTranslation',
    name: 'Valid HTML Translation',
    docs: {
      description: 'This check exists to prevent invalid HTML inside translations.',
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/valid-html-translation',
      recommended: true,
    },
    type: SourceCodeType.JSON,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    // We ignore non-`locales/` json files.
    const relativePath = context.relativePath(context.file.absolutePath);
    if (!relativePath.startsWith('locales/')) return {};

    return {
      async Literal(node: LiteralNode) {
        const htmlRegex = /<[^>]+>/;

        if (typeof node.value !== 'string' || !htmlRegex.test(node.value)) return;

        try {
          toLiquidHtmlAST(node.value);
        } catch (error) {
          const loc = node.loc as Location;

          const problem: Problem<SourceCodeType.JSON> = {
            message: `${error}.`,
            startIndex: loc.start.offset,
            endIndex: loc.end.offset,
          };
          context.report(problem);
        }
      },
    };
  },
};
