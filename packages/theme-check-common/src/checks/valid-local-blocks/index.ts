import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { toJSONAST } from '../../to-source-code';
import { collectBlockProperties, reportError } from './valid-block-utils';

type Location = {
  startIndex: number;
  endIndex: number;
};

export const ValidLocalBlocks: LiquidCheckDefinition = {
  meta: {
    code: 'ValidLocalBlocks',
    name: 'Prevent mixing static and local blocks in non-theme sections',
    docs: {
      description:
        'Ensures sections without theme block support do not mix static and local blocks',
      recommended: false,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/valid-local-blocks',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    const isSection = relativePath.startsWith('sections/');
    const isThemeBlock = relativePath.startsWith('blocks/');

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const jsonFile = toJSONAST(jsonString);
        if (jsonFile instanceof Error) return;

        const {
          hasLocalBlocks,
          hasStaticBlocks,
          hasThemeBlocks,
          localBlockLocations,
          staticBlockLocations,
          themeBlockLocations,
          staticBlockNameLocations,
        } = collectBlockProperties(jsonFile);

        if (isSection) {
          staticBlockNameLocations.forEach(
            reportError('Static theme blocks cannot have a name property.', context, node),
          );

          if (hasLocalBlocks && hasStaticBlocks) {
            staticBlockLocations.forEach(
              reportError(
                `Sections cannot use static theme blocks together with locally scoped blocks.`,
                context,
                node,
              ),
            );
          }

          if (hasLocalBlocks && hasThemeBlocks) {
            themeBlockLocations.forEach(
              reportError(
                'Sections cannot use theme blocks together with locally scoped blocks.',
                context,
                node,
              ),
            );
          }
        }

        if (isThemeBlock && hasLocalBlocks) {
          localBlockLocations.forEach(
            reportError('Local scoped blocks are not supported in theme blocks.', context, node),
          );
        }
      },
    };
  },
};
