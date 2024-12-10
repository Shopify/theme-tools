import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import {
  ArrayNode,
  Context,
  JSONNode,
  LiquidCheckDefinition,
  Severity,
  SourceCodeType,
} from '../../types';
import { Preset } from '../../types/schemas/preset';

export const SchemaPresetsBlockOrder: LiquidCheckDefinition = {
  meta: {
    code: 'SchemaPresetsBlockOrder',
    name: 'Gives recommendations and validations for block_order',
    docs: {
      description:
        'Gives recommendations and validations for block_order for preset blocks as a hash.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/schema-presets-block-order',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const offset = node.blockStartPosition.end;
        const schema = await getSchema(context);
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const presets = validSchema.presets;
        if (!presets) return;

        presets.forEach((preset, index) => {
          if ('blocks' in preset && preset.blocks) {
            checkBlockOrder(preset, context, offset, ast, ['presets', String(index)]);
          }
        });
      },
    };
  },
};

function checkBlockOrder(
  node: Preset.Preset | Preset.PresetBlockForHash,
  context: Context<SourceCodeType.LiquidHtml>,
  offset: number,
  ast: JSONNode,
  ast_path: string[],
) {
  if ('blocks' in node && typeof node.blocks == 'object' && node.blocks) {
    const blockOrder = 'block_order' in node ? node.block_order : undefined;
    // check 1: is block_order missing?
    if (!blockOrder) {
      if (shouldHaveBlockOrder(node)) {
        reportWarning(context, offset, ast, ast_path, `block_order is missing`, false);
      }
    }

    // check 2: are items in block_order present in blocks?
    blockOrder?.forEach((block_id, index) => {
      if (!node.blocks || (!Array.isArray(node.blocks) && !node.blocks[block_id])) {
        const warning_ast_path = ast_path.concat(['block_order']).concat([String(index)]);
        reportWarning(
          context,
          offset,
          ast,
          warning_ast_path,
          `block '${block_id}' is missing from 'blocks'`,
        );
      }
    });

    // check 3: are items in blocks correctly in block_order?
    for (const [block_id, block] of Object.entries(node.blocks)) {
      if (block.static) {
        // if static block is in the block_order, that's an error
        if (Array.isArray(blockOrder) && blockOrder.includes(block_id)) {
          const warning_ast_path = ast_path.concat(['block_order']);
          reportWarning(
            context,
            offset,
            ast,
            warning_ast_path,
            `static block '${block_id}' cannot be in the block_order`,
          );
        }
      } else {
        // if non-static block is not in the block_order, that's a potential mistake
        if (Array.isArray(blockOrder) && !blockOrder.includes(block_id)) {
          const warning_ast_path = ast_path.concat(['block_order']);
          reportWarning(
            context,
            offset,
            ast,
            warning_ast_path,
            `block '${block_id}' is missing from the block_order`,
          );
        }
      }

      //recursive check for nested blocks
      if (block.blocks) {
        ast_path.push('blocks', block_id); // so we'll get ['presets', 0, 'blocks', 'my_block1'] for example to do nodeAtPath(schema.ast, ast_path)
        checkBlockOrder(block, context, offset, ast, ast_path);
      }
    }
  }
}

function shouldHaveBlockOrder(node: Preset.Preset | Preset.PresetBlockForHash): boolean {
  if (
    'blocks' in node &&
    typeof node.blocks === 'object' &&
    node.blocks !== null &&
    !Array.isArray(node.blocks)
  ) {
    return Object.entries(node.blocks).some(([_blockId, block]) => {
      // If static is undefined or false, it's considered non-static
      return block.static !== true;
    });
  }

  return false;
}

function reportWarning(
  context: Context<SourceCodeType.LiquidHtml>,
  offset: number,
  ast: JSONNode,
  ast_path: string[],
  message: string,
  fullHighlight: boolean = true,
) {
  const node = nodeAtPath(ast, ast_path)! as ArrayNode;
  const startIndex = fullHighlight ? offset + getLocStart(node) : offset + getLocEnd(node) - 1; // start to finish of the node or last char of the node
  const endIndex = offset + getLocEnd(node);
  context.report({
    message: message,
    startIndex,
    endIndex,
  });
}
