import { ArrayNode } from 'json-to-ast';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { basename } from '../../path';
import { isBlock, isSection } from '../../to-schema';
import { JSONNode, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { Preset } from '../../types/schemas/preset';
import { ThemeBlock } from '../../types/schemas/theme-block';
import { Context } from '../../types';
import { getSchema } from '../../to-schema';
import { isContentForBlock } from '../../utils/markup';
import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';

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
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    type StaticBlock = {
      type: string;
      startIndex: number;
      endIndex: number;
    }
    let contentForBlockList: string[] = [];
    let staticBlockList: StaticBlock[] = [];
    let offset: number = 0;

    function checkStaticBlocks() {
      console.log(`contentForBlockList: ${contentForBlockList}`);
      console.log(`staticBlockList: ${staticBlockList}`);
      staticBlockList.forEach((block) => {
        console.log(`Checking static block ${block.type}`);
        if (!contentForBlockList.includes(block.type)) {
          console.log(`Static block ${block.type} is missing a corresponding content_for "block" tag.`);
          context.report({
            message: `Static block ${block.type} is missing a corresponding content_for "block" tag.`,
            startIndex: block.startIndex,
            endIndex: block.endIndex,
          });
        }
      });
    }

    return {
      async LiquidRawTag(node) {
        // if content_for "block", we add the block type to the list of static blocks
        if (node.name === NamedTags.content_for) {
          console.log(`content_for tag found`);
          if (!isContentForBlock(node.markup)) {
            return;
          }
          const typeArg = node.markup.args.find((arg) => arg.name === 'type');
          if (!typeArg) {
            return;
          }
          const typeArgValueNode = typeArg.value;
          if (typeArgValueNode.type !== NodeTypes.String) {
            return;
          }
          contentForBlockList.push(typeArgValueNode.value); // this is the value of the type arg on content_for "block"
          return;
        }

        // then go through the schema and get the list of static blocks from each preset
        else if (node.name === 'schema' && node.body.kind === 'json') {
          offset = node.blockStartPosition.end;
          const schema = await getSchema(context);
          const { validSchema, ast } = schema ?? {};
          if (!validSchema || validSchema instanceof Error) return;
          if (!ast || ast instanceof Error) return;

          const presets = validSchema.presets;
          if (!presets) return;

          presets.forEach((preset, index) => {
            if ('blocks' in preset && preset.blocks) {
              //const ast_path = ['presets', String(index)]
              if (Array.isArray(preset.blocks)) {
                preset.blocks.forEach((block, index) => {            
                  if(block.static === true) {
                    // might have to build ast_path instead
                    //ast_path.concat(['blocks']).concat([String(index)]);
                    staticBlockList.push({
                      type: block.type,
                      startIndex: node.blockStartPosition.start,
                      endIndex: node.blockStartPosition.end
                    });
                  }
                });
              }
            }
          });
          return;
        }
      },

      async onCodePathEnd() {
        checkStaticBlocks();
      }
    };
  },
};