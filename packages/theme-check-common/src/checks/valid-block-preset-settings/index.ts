//we want to check if the preset key exists in the settings

import { isSection } from '../../to-schema';
import { basename } from '../../path';
import { isBlock } from '../../to-schema';
import { LiquidCheckDefinition, Preset, Severity, SourceCodeType, ThemeBlock } from '../../types';

export const ValidBlockPresetSettings: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockPresetSettings',
    name: 'Reports invalid preset settings for a theme block',
    docs: {
      description: 'Reports invalid preset settings for a theme block',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/preset-key-exists',
    },
    severity: Severity.ERROR,
    type: SourceCodeType.LiquidHtml,
    schema: {},
    targets: [],
  },

  create(context) {
    function getSchema() {
      const name = basename(context.file.uri, '.liquid');
      switch (true) {
        case isBlock(context.file.uri):
          return context.getBlockSchema?.(name);
        case isSection(context.file.uri):
          return context.getSectionSchema?.(name);
        default:
          return undefined;
      }
    }

    function getInlineSettingsTypesandKeys(settings: ThemeBlock.Schema['settings']) {
      if (!settings) return [];
      return settings.map((setting: { id: any; type: any }) => ({
        id: setting.id,
        type: setting.type,
      }));
    }

    function getPresetSettingsKeys(presets: Preset.Preset[]) {
      const allKeys: string[] = [];
      for (const preset of presets) {
        if (preset.settings) {
          allKeys.push(...Object.keys(preset.settings));
        }
      }
      return allKeys;
    }

    function getPresetBlockSettingsKeys(blocks: Preset.PresetBlocks) {
      const allKeys: string[] = [];
      for (const block of Object.values(blocks)) {
        for (const [_, blockData] of Object.entries(block)) {
          if (blockData && typeof blockData === 'object' && 'settings' in blockData) {
            allKeys.push(...Object.keys(blockData.settings));
          }
        }
        return allKeys;
      }
    }

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const schema = await getSchema();
        if (!schema) return;
        if (schema.validSchema instanceof Error) return;

        const validSchema = schema.validSchema;
        const settingsKeys = getInlineSettingsTypesandKeys(validSchema.settings);
        const presetSettingsKeys = getPresetSettingsKeys(validSchema.presets ?? []);

        for (const key of presetSettingsKeys) {
          if (!settingsKeys.some((setting) => setting.id === key)) {
            context.report({
              message: `Preset setting "${key}" does not exist in the block's settings`,
              startIndex: 0,
              endIndex: 0,
            });
          }
        }

        if (validSchema.blocks) {
          for (const block of validSchema.blocks) {
            const blockSchema = await context.getBlockSchema?.(block.type);
            if (!blockSchema || blockSchema.validSchema instanceof Error) continue;

            for (const preset of validSchema.presets ?? []) {
              if (!preset.blocks) continue;
              const presetBlockSettingKeys = getPresetBlockSettingsKeys(preset.blocks) ?? [];

              for (const key of presetBlockSettingKeys) {
                if (!blockSchema.validSchema.settings?.some((setting) => setting.id === key)) {
                  context.report({
                    message: `Preset setting "${key}" does not exist in the block type "${block.type}"'s settings`,
                    startIndex: 0,
                    endIndex: 0,
                  });
                }
              }
            }
          }
        }
      },
    };
  },
};
