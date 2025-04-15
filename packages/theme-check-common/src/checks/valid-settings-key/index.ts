import {
  LiquidCheckDefinition,
  Severity,
  SourceCodeType,
  Preset,
  Section,
  ThemeBlock,
  JSONNode,
  Setting,
} from '../../types';
import { nodeAtPath } from '../../json';
import { getSchema, isSectionSchema } from '../../to-schema';
import { BlockDefNodeWithPath, getBlocks, reportWarning } from '../../utils';

export const ValidSettingsKey: LiquidCheckDefinition = {
  meta: {
    code: 'ValidSettingsKey',
    name: 'Validate settings key in presets',
    docs: {
      description:
        'Ensures settings key only references valid settings defined in its respective schema',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-settings-key',
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

        const { rootLevelLocalBlocks, presetLevelBlocks } = getBlocks(validSchema);

        // Check if presets settings match schema-level settings
        if (validSchema.presets) {
          for (let i = 0; i < validSchema.presets.length; i++) {
            const settingsNode = nodeAtPath(ast, ['presets', i, 'settings']);

            validateSettingsKey(context, offset, settingsNode, validSchema.settings);
          }
        }

        if (isSectionSchema(schema) && 'default' in validSchema && validSchema.default) {
          // Check if default settings match schema-level settings
          const settingsNode = nodeAtPath(ast, ['default', 'settings']);

          validateSettingsKey(context, offset, settingsNode, validSchema.settings);

          // Check if default block settings match the settings defined in the block file's schema
          validSchema.default.blocks?.forEach((block, i) => {
            const settingsNode = nodeAtPath(ast, ['default', 'blocks', i, 'settings']);

            validateReferencedBlock(context, offset, settingsNode, rootLevelLocalBlocks, block);
          });
        }

        // Check if preset block settings match the settings defined in the block file's schema
        for (const [_depthStr, blocks] of Object.entries(presetLevelBlocks)) {
          blocks.forEach(({ node: blockNode, path }) => {
            const settingsNode = nodeAtPath(ast, path.slice(0, -1).concat('settings'));

            validateReferencedBlock(context, offset, settingsNode, rootLevelLocalBlocks, blockNode);
          });
        }
      },
    };
  },
};

async function validateReferencedBlock(
  context: any,
  offset: number,
  settingsNode: JSONNode | undefined,
  localBlocks: BlockDefNodeWithPath[],
  referencedBlock: Preset.Block | Section.Block | ThemeBlock.Block,
) {
  if (localBlocks.length > 0) {
    const localBlock = localBlocks.find(
      (localBlock) => localBlock.node.type === referencedBlock.type,
    );

    if (!localBlock) return;

    const localBlockNode = localBlock.node as Section.LocalBlock;

    validateSettingsKey(context, offset, settingsNode, localBlockNode.settings);
  } else {
    const blockSchema = await context.getBlockSchema?.(referencedBlock.type);
    const { validSchema: validBlockSchema } = blockSchema ?? {};
    if (!validBlockSchema || validBlockSchema instanceof Error) return;

    validateSettingsKey(context, offset, settingsNode, validBlockSchema.settings, referencedBlock);
  }
}

function validateSettingsKey(
  context: any,
  offset: number,
  settingsNode: JSONNode | undefined,
  validSettings: Setting.Any[] | undefined,
  blockNode?: Section.Block | ThemeBlock.Block | Preset.Block,
) {
  if (!settingsNode || settingsNode.type !== 'Object') return;

  for (const setting of settingsNode.children) {
    const settingExists = validSettings?.find(
      (validSetting) => validSetting?.id === setting.key.value,
    );

    if (!settingExists) {
      const errorMessage = blockNode
        ? `Setting '${setting.key.value}' does not exist in 'blocks/${blockNode.type}.liquid'.`
        : `Setting '${setting.key.value}' does not exist in schema.`;

      reportWarning(errorMessage, offset, setting.key, context);
    }
  }
}
