import { nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import {
  LiquidCheckDefinition,
  LiteralNode,
  Section,
  Severity,
  SourceCodeType,
  ThemeBlock,
} from '../../types';
import {
  getBlocks,
  reportWarning,
  validateBlockFileExistence,
  validateNestedBlocks,
  isInvalidPresetBlock,
  isInvalidDefaultBlock,
} from '../../utils';

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
        const { staticBlockDefs } = schema;

        const {
          rootLevelThemeBlocks,
          rootLevelLocalBlocks,
          presetLevelBlocks,
          defaultLevelBlocks,
        } = getBlocks(validSchema);

        if (rootLevelLocalBlocks.length > 0) return;

        let errorsInRootLevelBlocks = false;
        await Promise.all(
          rootLevelThemeBlocks.map(async ({ node, path }) => {
            const typeNode = nodeAtPath(ast, path)! as LiteralNode;
            const exists = await validateBlockFileExistence(node.type, context);
            if (!exists) {
              errorsInRootLevelBlocks = true;
              reportWarning(blockDoesNotExistError(node.type), offset, typeNode, context);
            }
          }),
        );

        if (errorsInRootLevelBlocks) return;

        for (const [depthStr, blocks] of Object.entries(presetLevelBlocks)) {
          const depth = parseInt(depthStr, 10);

          if (depth === 0) {
            await Promise.all(
              blocks.map(async ({ node, path }) => {
                const typeNode = nodeAtPath(ast, path)! as LiteralNode;
                const blockId = 'id' in node ? node.id! : path.at(-2)!;
                const isStaticBlock = !!node.static;

                if (isInvalidPresetBlock(blockId, node, rootLevelThemeBlocks, staticBlockDefs)) {
                  const errorMessage = isStaticBlock
                    ? `Could not find a static block of type "${node.type}" with id "${blockId}" in this file.`
                    : reportMissingThemeBlockDefinitionError(node);
                  reportWarning(errorMessage, offset, typeNode, context);
                }

                const exists = await validateBlockFileExistence(node.type, context);
                if (exists) {
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
                } else {
                  reportWarning(blockDoesNotExistError(node.type), offset, typeNode, context);
                }
              }),
            );
          }
        }

        await Promise.all(
          defaultLevelBlocks.map(async ({ node, path }) => {
            const typeNode = nodeAtPath(ast, path)! as LiteralNode;

            if (isInvalidDefaultBlock(node, rootLevelThemeBlocks)) {
              reportWarning(
                reportMissingThemeBlockDefinitionError(node),
                offset,
                typeNode,
                context,
              );
            }

            const exists = await validateBlockFileExistence(node.type, context);
            if (!exists) {
              reportWarning(blockDoesNotExistError(node.type), offset, typeNode, context);
            }
          }),
        );
      },
    };
  },
};

function reportMissingThemeBlockDefinitionError(node: Section.Block | ThemeBlock.Block) {
  const isPrivateBlockType = node.type.startsWith('_');
  return isPrivateBlockType
    ? `Theme block type "${node.type}" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.`
    : `Theme block type "${node.type}" must be allowed in "blocks" at the root of this schema.`;
}

function blockDoesNotExistError(name: string) {
  return `Theme block 'blocks/${name}.liquid' does not exist.`;
}
