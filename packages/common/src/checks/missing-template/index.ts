import { LiquidTag, LiquidTagNamed } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import { NamedTags, NodeTypes, Position } from '@shopify/prettier-plugin-liquid/dist/types';
import {
  LiquidCheckDefinition,
  LiquidSourceCode,
  RelativePath,
  Severity,
  SourceCodeType,
} from '../../types';

export const MissingTemplate: LiquidCheckDefinition = {
  meta: {
    code: 'MissingTemplate',
    name: 'Avoid rendering missing templates',
    docs: {
      description: 'Reports missing include/render/section liquid file',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const isNamedLiquidTag = (tag: LiquidTag): tag is LiquidTagNamed =>
      typeof tag.markup !== 'string';

    const check = async (
      file: LiquidSourceCode,
      requiredPath: RelativePath,
      { position }: { position: Position },
    ) => {
      const absolutePath = context.absolutePath(requiredPath);
      const fileExists = await context.fileExists(absolutePath);

      if (fileExists) return;

      context.report(file, {
        message: `'${requiredPath}' is not found`,
        startIndex: position.start,
        endIndex: position.end,
      });
    };

    return {
      async RenderMarkup(node, file) {
        if (node.snippet.type === NodeTypes.VariableLookup) return;

        const snippet = node.snippet;
        const requiredPath = `snippets/${snippet.value}.liquid`;

        check(file, requiredPath, snippet);
      },

      async LiquidTag(node, file) {
        if (!isNamedLiquidTag(node)) return;
        if (node.name !== NamedTags.section) return;

        const markup = node.markup;
        const requiredPath = `sections/${markup.value}.liquid`;

        check(file, requiredPath, markup);
      },
    };
  },
};
