import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema } from '../../to-schema';
import { ArrayNode, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isContentForBlock } from '../../utils/markup';

export const SchemaPresetsStaticBlocks: LiquidCheckDefinition = {
  meta: {
    code: 'SchemaPresetsStaticBlocks',
    name: 'Ensure the preset static blocks are used in the liquid',
    docs: {
      description:
        'Warns if a preset static block does not have a corresponding content_for "block" tag.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/schema-presets-static-blocks',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    type contentForBlock = {
      id: string;
      type: string;
    };
    type StaticBlock = {
      id: string;
      type: string;
      startIndex: number;
      endIndex: number;
    };
    let contentForBlockList: contentForBlock[] = [];
    let staticBlockList: StaticBlock[] = [];
    let offset: number = 0;

    function checkStaticBlocks() {
      staticBlockList.forEach((block) => {
        if (
          !contentForBlockList.some(
            (contentBlock) => contentBlock.id === block.id && contentBlock.type === block.type,
          )
        ) {
          context.report({
            message: `Static block ${block.id} is missing a corresponding content_for "block" tag.`,
            startIndex: block.startIndex,
            endIndex: block.endIndex,
          });
        }
      });
    }

    return {
      async LiquidTag(node) {
        // Early return if not a content_for block tag
        if (node.name !== NamedTags.content_for || !isContentForBlock(node.markup)) return;

        // Extract id and type from markup args
        const idValue = node.markup.args.find((arg) => arg.name === 'id')?.value;
        const typeArg = node.markup.args.find((arg) => arg.name === 'type')?.value;
        if (!typeArg || typeArg.type !== NodeTypes.String) {
          return; // covered by VariableContentForArguments
        }
        const typeValue = typeArg.value;

        // Add to list if valid string id
        if (idValue?.type === NodeTypes.String) {
          contentForBlockList.push({ id: idValue.value, type: typeValue });
        }
      },

      async LiquidRawTag(node) {
        // when we get the schema tag, get the list of static blocks from each preset
        if (node.name === 'schema' && node.body.kind === 'json') {
          offset = node.blockStartPosition.end;
          const schema = await getSchema(context);
          const { validSchema, ast } = schema ?? {};
          if (!validSchema || validSchema instanceof Error) return;
          if (!ast || ast instanceof Error) return;

          const presets = validSchema.presets;
          if (!presets) return;

          presets.forEach((preset, index) => {
            if ('blocks' in preset && preset.blocks) {
              let ast_path: any[] = ['presets', index, 'blocks'];
              // blocks as an array
              if (Array.isArray(preset.blocks)) {
                preset.blocks.forEach((block, block_index) => {
                  if (block.static === true && block.id) {
                    let node = nodeAtPath(ast, ast_path.concat([block_index]))! as ArrayNode;
                    staticBlockList.push({
                      id: block.id,
                      type: block.type,
                      startIndex: offset + getLocStart(node),
                      endIndex: offset + getLocEnd(node),
                    });
                  }
                });
              }
              // blocks as an object
              else if (typeof preset.blocks === 'object') {
                Object.entries(preset.blocks).forEach(([block_id, block]) => {
                  if (block.static === true) {
                    let node = nodeAtPath(ast, ast_path.concat(block_id))! as ArrayNode;
                    staticBlockList.push({
                      id: block_id,
                      type: block.type,
                      startIndex: offset + getLocStart(node),
                      endIndex: offset + getLocEnd(node),
                    });
                  }
                });
              }
            }
          });
        }
      },

      async onCodePathEnd() {
        checkStaticBlocks();
      },
    };
  },
};
