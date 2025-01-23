import { isSection, isBlock } from '../../to-schema';
import { basename } from '../../path';
import {
  JSONNode,
  LiquidCheckDefinition,
  LiteralNode,
  Severity,
  SourceCodeType,
} from '../../types';
import { nodeAtPath } from '../../json';
import {
  BlockNodeWithPath,
  getBlocks,
  validateBlockFileExistence,
} from '../valid-block-target/block-utils';
import { Section } from '../../types/schemas/section';

export const ValidPresetAndDefaultSettings: LiquidCheckDefinition = {
  meta: {
    code: 'ValidPresetAndDefaultSettings',
    name: 'Reports invalid preset and default settings for sections and blocks',
    docs: {
      description: 'Reports invalid preset and default settings for sections and blocks',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-preset-and-default-settings',
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

    const extractDefaultBlockSettingIds = (
      ast: JSONNode,
      blocks: Record<string, any>[],
      path: string[] = ['default', 'blocks'],
    ): { key: string; start: any; end: any }[] => {
      let settingIds: { key: string; start: any; end: any }[] = [];

      for (const [blockIndex, block] of blocks.entries()) {
        const currentPath = [...path, blockIndex.toString()];

        for (const [settingId, _] of Object.entries(block.settings ?? {})) {
          const node = nodeAtPath(ast, [...currentPath, 'settings']);
          if (node?.loc) {
            settingIds.push({
              key: settingId,
              start: node.loc.start.offset,
              end: node.loc.end.offset,
            });
          }
        }

        if (block.blocks && Array.isArray(block.blocks)) {
          const nestedSettingIds = extractDefaultBlockSettingIds(ast, block.blocks, [
            ...currentPath,
            'blocks',
          ]);
          settingIds = [...settingIds, ...nestedSettingIds];
        }
      }

      return settingIds;
    };

    const extractPresetBlockSettingIds = (
      ast: JSONNode,
      presetIndex: number,
      blocks: Record<string, any>,
      path: string[] = ['presets', presetIndex.toString(), 'blocks'],
    ): { key: string; start: any; end: any }[] => {
      let settingIds: { key: string; start: any; end: any }[] = [];

      for (const [blockIndex, block] of Object.entries(blocks)) {
        const currentPath = [...path, blockIndex];
        for (const [settingId, settingValue] of Object.entries(block.settings ?? {})) {
          const node = nodeAtPath(ast, [...currentPath, 'settings']);
          if (node?.loc) {
            settingIds.push({
              key: settingId,
              start: node.loc.start.offset,
              end: node.loc.end.offset,
            });
          }
        }

        if (block.blocks) {
          const nestedSettingIds = extractPresetBlockSettingIds(ast, presetIndex, block.blocks, [
            ...currentPath,
            'blocks',
          ]);
          settingIds = [...settingIds, ...nestedSettingIds];
        }
      }

      return settingIds;
    };

    const extractSchemaBlockSettingIds = async (
      blocks: Record<string, any>[],
      context: any,
      currentPath: string[] = [],
    ): Promise<string[]> => {
      let settingIds: string[] = [];

      for (const block of blocks) {
        if (block.type && block.type !== '@app' && !('name' in block)) {
          const blockSchema = await context.getBlockSchema?.(block.type);
          if (!blockSchema || blockSchema instanceof Error) return [];

          if (blockSchema) {
            const { validSchema } = blockSchema;
            if (validSchema?.settings) {
              settingIds = [
                ...settingIds,
                ...validSchema.settings.map((setting: { id: string }) => setting.id),
              ];
            }

            if (validSchema?.blocks && Array.isArray(validSchema.blocks)) {
              const nestedSettingIds = await extractSchemaBlockSettingIds(
                validSchema.blocks,
                context,
                [...currentPath, 'blocks'],
              );
              settingIds = [...settingIds, ...nestedSettingIds];
            }
          }
        }

        if (Array.isArray(block.settings)) {
          settingIds = [
            ...settingIds,
            ...block.settings.map((setting: { id: string }) => setting.id),
          ];
        } else if (block.settings && typeof block.settings === 'object') {
          settingIds = [...settingIds, ...Object.keys(block.settings)];
        }

        if (block.blocks && Array.isArray(block.blocks)) {
          const nestedSettingIds = await extractSchemaBlockSettingIds(block.blocks, context, [
            ...currentPath,
            'blocks',
          ]);
          settingIds = [...settingIds, ...nestedSettingIds];
        }
      }

      return settingIds;
    };

    return {
      async LiquidRawTag() {
        const schema = await getSchema();
        if (!schema) return;
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const settingIds = validSchema.settings?.map((setting) => setting.id);

        let presetSettingsIds: { key: string; start: any; end: any }[] = [];
        for (const [presetIndex, preset] of validSchema.presets?.entries() ?? []) {
          for (const [settingId, _] of Object.entries(preset.settings ?? {})) {
            const node = nodeAtPath(ast, ['presets', presetIndex.toString(), 'settings']);
            presetSettingsIds.push({
              key: settingId,
              start: { offset: node!.loc!.start.offset },
              end: { offset: node!.loc!.end.offset },
            });
          }
        }

        let defaultSettingsIds: { key: string; start: any; end: any }[] = [];
        for (const [settingId, _] of Object.entries(
          (validSchema as Section.Schema).default?.settings ?? {},
        )) {
          const node = nodeAtPath(ast, ['default', 'settings']);
          defaultSettingsIds.push({
            key: settingId,
            start: node!.loc!.start.offset,
            end: node!.loc!.end.offset,
          });
        }

        for (const defaultSettingId of defaultSettingsIds) {
          if (!settingIds!.includes(defaultSettingId.key)) {
            context.report({
              startIndex: defaultSettingId!.start.offset,
              endIndex: defaultSettingId!.end.offset,
              message: `Default setting "${defaultSettingId.key}" does not exist in settings`,
            });
          }
        }

        for (const presetSettingId of presetSettingsIds) {
          if (!settingIds!.includes(presetSettingId.key)) {
            context.report({
              startIndex: presetSettingId!.start.offset,
              endIndex: presetSettingId!.end.offset,
              message: `Preset setting "${presetSettingId.key}" does not exist in settings`,
            });
          }
        }

        const schemaBlockSettingIds = await extractSchemaBlockSettingIds(
          validSchema.blocks ?? [],
          context,
        );

        let presetNestedBlockSettingIds: { key: string; start: any; end: any }[] = [];
        for (const [presetIndex, preset] of validSchema.presets?.entries() ?? []) {
          if ('blocks' in preset) {
            const blocksArray = preset.blocks
              ? Array.isArray(preset.blocks)
                ? preset.blocks
                : Object.values(preset.blocks)
              : [];
            const settingIds = extractPresetBlockSettingIds(ast, presetIndex, blocksArray);
            presetNestedBlockSettingIds = [...presetNestedBlockSettingIds, ...settingIds];
          }
        }

        let defaultNestedBlockSettingIds: { key: string; start: any; end: any }[] = [];
        const asSection = validSchema as Section.Schema;
        if (asSection?.default?.blocks) {
          try {
            defaultNestedBlockSettingIds = extractDefaultBlockSettingIds(
              ast,
              asSection.default.blocks,
            );
          } catch (error) {}
        }

        if (presetNestedBlockSettingIds && presetNestedBlockSettingIds.length > 0) {
          for (const presetNestedBlockSettingId of presetNestedBlockSettingIds) {
            if (!schemaBlockSettingIds?.includes(presetNestedBlockSettingId.key)) {
              context.report({
                startIndex: presetNestedBlockSettingId.start?.offset,
                endIndex: presetNestedBlockSettingId.end?.offset,
                message: `Preset block setting "${presetNestedBlockSettingId.key}" does not exist in settings`,
              });
            }
          }
        }

        for (const defaultNestedBlockSettingId of defaultNestedBlockSettingIds) {
          if (!schemaBlockSettingIds!.includes(defaultNestedBlockSettingId.key)) {
            context.report({
              startIndex: defaultNestedBlockSettingId!.start,
              endIndex: defaultNestedBlockSettingId!.end,
              message: `Default block setting "${defaultNestedBlockSettingId.key}" does not exist in settings`,
            });
          }
        }
      },
    };
  },
};
