import {
  LiquidCheckDefinition,
  Severity,
  SourceCodeType,
  Preset,
  Section,
  ThemeBlock,
  LiteralNode,
} from '../../types';
import { nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import {
  getBlocks,
  isInvalidPresetBlock,
  validateNestedBlocks,
  validateBlockFileExistence,
  reportOnJsonNode,
} from '../../utils';
type BlockNodeWithPath = {
  node: Section.Block | ThemeBlock.Block | Preset.Block;
  path: string[];
};

export const ValidBlockTarget: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockTarget',
    name: 'Validate block targeting in presets',
    docs: {
      description:
        'Ensures block types only reference valid block types and respect parent-child relationships',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-target',
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

        const { rootLevelThemeBlocks, rootLevelLocalBlocks, presetLevelBlocks } =
          getBlocks(validSchema);

        if (rootLevelLocalBlocks.length > 0) return;

        let errorsInRootLevelBlocks = false;
        await Promise.all(
          rootLevelThemeBlocks.map(async ({ node, path }: BlockNodeWithPath) => {
            const typeNode = nodeAtPath(ast, path)! as LiteralNode;
            const exists = await validateBlockFileExistence(node.type, context);
            if (!exists) {
              errorsInRootLevelBlocks = true;
              reportOnJsonNode(
                `Theme block 'blocks/${node.type}.liquid' does not exist.`,
                offset,
                typeNode,
                context,
              );
            }
          }),
        );

        if (errorsInRootLevelBlocks) return;

        let errorsInPresetLevelBlocks = false;
        for (const [depthStr, blocks] of Object.entries(presetLevelBlocks)) {
          const depth = parseInt(depthStr, 10);

          if (depth === 0) {
            await Promise.all(
              blocks.map(async ({ node, path }: BlockNodeWithPath) => {
                const typeNode = nodeAtPath(ast, path)! as LiteralNode;
                const isPrivateBlockType = node.type.startsWith('_');
                if (isInvalidPresetBlock(node, rootLevelThemeBlocks)) {
                  errorsInPresetLevelBlocks = true;
                  const errorMessage = isPrivateBlockType
                    ? `Theme block type "${node.type}" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.`
                    : `Theme block type "${node.type}" must be allowed in "blocks" at the root of this schema.`;
                  reportOnJsonNode(errorMessage, offset, typeNode, context);
                }

                if ('blocks' in node && node.blocks) {
                  await validateNestedBlocks(
                    context,
                    node,
                    node.blocks,
                    path.slice(0, -1),
                    offset,
                    ast,
                  );
                }
              }),
            );
          }

          if (!errorsInPresetLevelBlocks) {
            await Promise.all(
              blocks.map(async ({ node, path }: BlockNodeWithPath) => {
                const typeNode = nodeAtPath(ast, path)! as LiteralNode;
                const exists = await validateBlockFileExistence(node.type, context);
                if (!exists) {
                  reportOnJsonNode(
                    `Theme block 'blocks/${node.type}.liquid' does not exist.`,
                    offset,
                    typeNode,
                    context,
                  );
                }
              }),
            );
          }
        }
      },
    };
  },
};
