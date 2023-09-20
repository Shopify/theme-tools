import {
  LiquidTag,
  LiquidTagNamed,
  NamedTags,
  NodeTypes,
  Position,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, RelativePath, Severity, SourceCodeType } from '../../types';
import { assertFileExists } from '../../utils/file-utils';

export const MissingTemplate: LiquidCheckDefinition = {
  meta: {
    code: 'MissingTemplate',
    name: 'Avoid rendering missing templates',
    docs: {
      description: 'Reports missing include/render/section liquid file',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/missing-template',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const isNamedLiquidTag = (tag: LiquidTag): tag is LiquidTagNamed =>
      typeof tag.markup !== 'string';

    async function contextReport(requiredPath: RelativePath, { position }: { position: Position }) {
      const fileExists = await assertFileExists(context, requiredPath);
      if (fileExists) return;

      context.report({
        message: `'${requiredPath}' does not exist`,
        startIndex: position.start,
        endIndex: position.end,
      });
    }

    return {
      async RenderMarkup(node) {
        if (node.snippet.type === NodeTypes.VariableLookup) return;

        const snippet = node.snippet;
        const requiredPath = `snippets/${snippet.value}.liquid`;

        await contextReport(requiredPath, snippet);
      },

      async LiquidTag(node) {
        if (!isNamedLiquidTag(node)) return;
        if (node.name !== NamedTags.section) return;

        const markup = node.markup;
        const requiredPath = `sections/${markup.value}.liquid`;

        await contextReport(requiredPath, markup);
      },
    };
  },
};
