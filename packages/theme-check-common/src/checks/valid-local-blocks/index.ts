import {
  LiquidCheckDefinition,
  Preset,
  Severity,
  SourceCodeType,
  Section,
  LiteralNode,
} from '../../types';
import { nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import { isBlock, isSection } from '../../to-schema';
import { getBlocks, reportWarning } from './valid-block-utils';

type BlockNodeWithPath = {
  node: Section.Block | Preset.Block;
  path: string[];
};

export const ValidLocalBlocks: LiquidCheckDefinition = {
  meta: {
    code: 'ValidLocalBlocks',
    name: 'Prevent mixing static and local blocks in non-theme sections',
    docs: {
      description:
        'Ensures sections without theme block support do not mix static and local blocks',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-local-blocks',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const offset = node.blockStartPosition.end;
        const schema = await getSchema(context);
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;
        if (!schema) return;

        const {
          staticBlockLocations,
          localBlockLocations,
          themeBlockLocations,
          hasRootLevelThemeBlocks,
        } = getBlocks(validSchema);

        if (isSection(context.file.uri)) {
          if (staticBlockLocations.length > 0 && localBlockLocations.length > 0) {
            staticBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              reportWarning(
                `Sections cannot use static theme blocks together with locally scoped blocks.`,
                offset,
                astNode,
                context,
              );
            });
          }

          if (
            hasRootLevelThemeBlocks &&
            localBlockLocations.length > 0 &&
            themeBlockLocations.length > 0
          ) {
            localBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              reportWarning(
                'Sections cannot use theme blocks together with locally scoped blocks.',
                offset,
                astNode,
                context,
              );
            });
          }
        }

        if (isBlock(context.file.uri)) {
          if (localBlockLocations.length > 0) {
            localBlockLocations.forEach((blockWithPath: BlockNodeWithPath) => {
              const astNode = nodeAtPath(ast, blockWithPath.path)! as LiteralNode;
              reportWarning(
                'Local scoped blocks are not supported in theme blocks.',
                offset,
                astNode,
                context,
              );
            });
          }
        }
      },
    };
  },
};
