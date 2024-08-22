import {
  LiquidTag,
  LiquidTagNamed,
  NamedTags,
  NodeTypes,
  Position,
} from '@shopify/liquid-html-parser';
import { minimatch } from 'minimatch';
import {
  LiquidCheckDefinition,
  RelativePath,
  SchemaProp,
  Severity,
  SourceCodeType,
} from '../../types';
import { doesFileExist } from '../../utils/file-utils';

const schema = {
  ignoreMissing: SchemaProp.array(SchemaProp.string(), []),
};

export const MissingTemplate: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'MissingTemplate',
    name: 'Avoid rendering missing templates',
    docs: {
      description: 'Reports missing include/render/section liquid file',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/missing-template',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema,
    targets: [],
  },

  create(context) {
    const isNamedLiquidTag = (tag: LiquidTag): tag is LiquidTagNamed =>
      typeof tag.markup !== 'string';

    function isIgnored(relativePath: string) {
      return context.settings.ignoreMissing.some((pattern) => minimatch(relativePath, pattern));
    }

    async function maybeReportMissing(
      relativePath: RelativePath,
      { position }: { position: Position },
    ) {
      const fileExists = await doesFileExist(context, relativePath);
      if (fileExists || isIgnored(relativePath)) return;

      context.report({
        message: `'${relativePath}' does not exist`,
        startIndex: position.start,
        endIndex: position.end,
      });
    }

    return {
      async RenderMarkup(node) {
        if (node.snippet.type === NodeTypes.VariableLookup) return;

        const snippet = node.snippet;
        const relativePath = `snippets/${snippet.value}.liquid`;

        await maybeReportMissing(relativePath, snippet);
      },

      async LiquidTag(node) {
        if (!isNamedLiquidTag(node)) return;
        if (node.name !== NamedTags.section) return;

        const markup = node.markup;
        const relativePath = `sections/${markup.value}.liquid`;

        await maybeReportMissing(relativePath, markup);
      },
    };
  },
};
