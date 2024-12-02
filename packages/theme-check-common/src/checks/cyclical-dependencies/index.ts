import { LiteralNode, ArrayNode } from 'json-to-ast';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { basename } from '../../path';
import { isBlock, isSection } from '../../to-schema';
import { JSONNode, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { isContentForBlock } from '../../utils/markup';
import { Section } from '../../types/schemas/section';
import { ThemeBlock } from '../../types/schemas/theme-block';
import { Context } from '../../types';
import { path } from '../..';

export const CyclicalDependencies: LiquidCheckDefinition = {
  meta: {
    code: 'CyclicalDependencies',
    name: 'Shows error when detecting cyclical dependencies',
    docs: {
      description:
        'Shows an error when a cyclical dependency is detected in the liquid.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/cyclical-dependencies',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    function traceContentForInclusions(blockType: string, inclusions: string[]) {
      // open the file for the block type
    }

    return {
      async LiquidTag(node) { //in this call, we just gather the content_for "block" in the liquid
        if (node.name !== 'content_for') {
          return;
        }

        if (!isContentForBlock(node.markup)) {
          return;
        }

        const typeArg = node.markup.args.find((arg) => arg.name === 'type');
        if (!typeArg) {
          return; // covered by VariableContentForArguments
        }

        const typeArgValueNode = typeArg.value;
        if (typeArgValueNode.type !== NodeTypes.String) {
          return; // covered by VariableContentForArguments
        }

        const contentForBlockType = typeArgValueNode.value; // this is the value of the type arg on content_for "block"

        const idArg = node.markup.args.find((arg) => arg.name === 'type');
        if (!idArg) {
          return; // covered by VariableContentForArguments
        }

        const idArgValueNode = idArg.value;
        if (idArgValueNode.type !== NodeTypes.String) {
          return; // covered by VariableContentForArguments
        }

        const contentForBlockId = idArgValueNode.value; // this is the value of the type arg on content_for "block"

        const fileRegex = /[\\/](sections|blocks)[\\/]([^\\/]+\.liquid)$/;
        let currentFileBlockType = path.basename(context.file.uri)

        let inclusions = [currentFileBlockType];
        traceContentForInclusions(contentForBlockType, inclusions);
        
        // if (contentForBlockType) {
        //   contentForBlockInstances[contentForBlockId] = {
        //     type: contentForBlockType,
        //     startIndex: node.blockStartPosition.start,
        //     endIndex: node.blockStartPosition.end
        //   };
        // }
      },
    };
  },
};