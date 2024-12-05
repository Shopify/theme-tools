import { isSection, isBlock } from '../../to-schema';
import { basename } from '../../path';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { nodeAtPath } from '../../json';
import { ObjectNode, PropertyNode } from 'json-to-ast';
import { getBlocks } from '../valid-block-target/block-utils';

export const ValidPresetSettings: LiquidCheckDefinition = {
  meta: {
    code: 'ValidPresetSettings',
    name: 'Reports invalid preset settings for sections and blocks',
    docs: {
      description: 'Reports invalid preset settings for sections and blocks',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-preset-settings',
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

    const getPresetSettingIds = (presetNode: ObjectNode) => {
      return presetNode.children
        .map((preset: PropertyNode) => {
          const settingsNode = preset.children.find(
            (prop: PropertyNode) => prop.key.value === 'settings',
          );
          if (settingsNode?.value?.children) {
            return settingsNode.value.children.map((setting: PropertyNode) => {
              const key = setting.key.value;
              const start = setting.loc?.start;
              const end = setting.loc?.end;
              return { key, start, end };
            });
          }
          return [];
        })
        .flat()
        .filter(Boolean);
    };

    return {
      async LiquidRawTag() {
        const schema = await getSchema();
        if (!schema) return;
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const presetNode = nodeAtPath(ast, ['presets']) as ObjectNode;
        if (!presetNode) return;

        const settingsNode = nodeAtPath(ast, ['settings']) as ObjectNode;
        if (!settingsNode) return;

        const presetSettingsIds = getPresetSettingIds(presetNode);

        const settingIds = settingsNode.children.map((child: PropertyNode) => {
          const idNode = child.children?.find((prop: PropertyNode) => prop.key.value === 'id');
          return idNode?.value?.value;
        });

        for (const presetSettingId of presetSettingsIds) {
          if (!settingIds.includes(presetSettingId.key)) {
            context.report({
              startIndex: presetSettingId.start.offset,
              endIndex: presetSettingId.end.offset,
              message: `Preset setting "${presetSettingId.key}" does not exist in settings`,
            });
          }
        }

        const { rootLevelThemeBlocks, rootLevelLocalBlocks, presetLevelBlocks } =
          getBlocks(validSchema);

        const rootLevelBlockSettingIds = await Promise.all(
          [...rootLevelThemeBlocks, ...rootLevelLocalBlocks].flat().map(async ({ node }) => {
            const blockSchema = await context.getBlockSchema?.(node.type);
            const { validSchema, ast } = blockSchema ?? {};

            if (!validSchema || validSchema instanceof Error) return [];
            if (!ast || ast instanceof Error) return [];

            const settingsNode = nodeAtPath(ast, ['settings']) as ObjectNode;
            if (!settingsNode?.children) return [];
            return settingsNode.children
              .filter((settingObj: PropertyNode) => {
                const typeNode = settingObj.children?.find(
                  (prop: PropertyNode) => prop.key.value === 'type',
                );
                return typeNode?.value?.value !== 'header';
              })
              .map((settingObj: PropertyNode) => {
                const idNode = settingObj.children.find(
                  (prop: PropertyNode) => prop.key.value === 'id',
                );
                return idNode?.value?.value;
              })
              .filter((id): id is string => Boolean(id));
          }),
        );

        let presetBlockSettingIds: { key: string; start: any; end: any }[] = [];
        await Promise.all(
          Object.values(presetLevelBlocks)
            .flat()
            .map(async (block) => {
              const blockPath = block.path.slice(0, -1);
              const blockNode = nodeAtPath(ast, blockPath) as ObjectNode;
              if (!blockNode) return;

              const settings = Object.values(block.node)[0]?.settings;
              if (settings) {
                for (const [key, value] of Object.entries(settings)) {
                  presetBlockSettingIds.push({
                    key,
                    start: blockNode.loc?.start,
                    end: blockNode.loc?.end,
                  });
                }
              }
            }),
        );

        for (const presetBlockSettingId of presetBlockSettingIds) {
          if (!rootLevelBlockSettingIds.flat().some((id) => id === presetBlockSettingId.key)) {
            context.report({
              startIndex: presetBlockSettingId?.start?.line ?? 0,
              endIndex: presetBlockSettingId?.end?.line ?? 0,
              message: `Preset block setting "${presetBlockSettingId.key}" does not exist in settings.`,
            });
          }
        }
      },
    };
  },
};
