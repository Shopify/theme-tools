import { JSONNode, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import {
  reportError,
  collectAndValidateBlockTypes,
  validateBlockFileExistence,
} from './block-utils';
import { toJSONAST } from '../../to-source-code';

type Location = {
  startIndex: number;
  endIndex: number;
};

export const ValidBlockTarget: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockTarget',
    name: 'Validate block targeting in presets',
    docs: {
      description:
        'Ensures block types only reference valid block types and respect parent-child relationships',
      recommended: false,
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
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const jsonString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const jsonFile = toJSONAST(jsonString);
        if (jsonFile instanceof Error) return;

        const { hasLocalBlocks, rootThemeBlockTypes, presetBlockTypes, nestedPresetBlockTypes } =
          collectAndValidateBlockTypes(jsonFile as JSONNode);

        if (hasLocalBlocks) return;
        let errorsInRootLevelBlocks = false;
        for (const [blockType, locations] of Object.entries(rootThemeBlockTypes)) {
          const exists = await validateBlockFileExistence(blockType, context);
          if (!exists) {
            locations.forEach(
              reportError(
                `Theme block 'blocks/${blockType}.liquid' does not exist.`,
                context,
                node,
              ),
            );
            errorsInRootLevelBlocks = true;
          }
        }

        if (errorsInRootLevelBlocks) return;

        for (const [presetType, locations] of Object.entries(presetBlockTypes)) {
          const isPrivateBlockType = presetType.startsWith('_');
          const isPresetInRootLevel = presetType in rootThemeBlockTypes;
          const isThemeInRootLevel = '@theme' in rootThemeBlockTypes;
          const needsExplicitRootBlock = isPrivateBlockType || !isThemeInRootLevel;

          if (!isPresetInRootLevel && needsExplicitRootBlock) {
            const errorMessage = isPrivateBlockType
              ? `Theme block type "${presetType}" is a private block so it must be explicitly allowed in "blocks" at the root of this schema.`
              : `Theme block type "${presetType}" must be allowed in "blocks" at the root of this schema.`;

            locations.forEach(reportError(errorMessage, context, node));
          } else {
            const exists = await validateBlockFileExistence(presetType, context);
            if (!exists) {
              locations.forEach(
                reportError(
                  `Theme block 'blocks/${presetType}.liquid' does not exist.`,
                  context,
                  node,
                ),
              );
            }
          }
        }

        // TODO: Validate nested preset block types via cross file check
      },
    };
  },
};
