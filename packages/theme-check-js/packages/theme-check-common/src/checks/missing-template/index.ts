import { LiquidTag, LiquidTagNamed } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import { NamedTags, NodeTypes, Position } from '@shopify/prettier-plugin-liquid/dist/types';
import { LiquidCheckDefinition, RelativePath, Severity, SourceCodeType } from '../../types';

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

    async function verifyFileExists(
      requiredPath: RelativePath,
      { position }: { position: Position },
    ) {
      const absolutePath = context.absolutePath(requiredPath);
      const fileExists = await context.fileExists(absolutePath);

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

        await verifyFileExists(requiredPath, snippet);
      },

      async LiquidTag(node) {
        if (!isNamedLiquidTag(node)) return;
        if (node.name !== NamedTags.section) return;

        const markup = node.markup;
        const requiredPath = `sections/${markup.value}.liquid`;

        await verifyFileExists(requiredPath, markup);
      },
    };
  },
};
