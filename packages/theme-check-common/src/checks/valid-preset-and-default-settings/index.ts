import { isSection, isBlock } from '../../to-schema';
import { basename } from '../../path';
import {
  ArrayNode,
  LiquidCheckDefinition,
  LiteralNode,
  ObjectNode,
  Preset,
  PropertyNode,
  Setting,
  Severity,
  SourceCodeType,
  ValueNode,
} from '../../types';
import { nodeAtPath } from '../../json';
import { BlockNodeWithPath, getBlocks } from '../valid-block-target/block-utils';

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

    const extractBlockSettings = (block: ValueNode) => {
      const blockSettings: { key: string; start: any; end: any }[] = [];
      (block as ObjectNode).children.forEach((node: PropertyNode) => {
        console.log('Node');
        console.log(node.value);
        if (node.value.type === 'Array') {
          console.log('ArrayEntering Recursion', node.value.children);
          blockSettings.push(...extractBlockSettings(node.value));
          console.log('\n');
        }

        const settingsNode = (block as ObjectNode).children.find(
          (child: PropertyNode) => child.key.value === 'settings',
        );

        if (settingsNode) {
          console.log('SettingsNode', settingsNode);
          blockSettings.push({
            key: settingsNode.key.value,
            start: settingsNode.loc?.start,
            end: settingsNode.loc?.end,
          });
        }

        debugger;
        return blockSettings;
      });
      return blockSettings;
    };

    const getNestedSettingIds = (preset: ArrayNode) => {
      return preset.children
        .map((node: ValueNode) => {
          const settingsNode = (node as ObjectNode).children!.find(
            (prop: PropertyNode) => prop.key.value === 'settings',
          );
          if ((settingsNode?.value as ObjectNode).children) {
            return (settingsNode?.value as ObjectNode).children.map((setting: PropertyNode) => {
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

        const settingsNode = nodeAtPath(ast, ['settings']) as ArrayNode;
        const presetNode = nodeAtPath(ast, ['presets']) as ArrayNode;
        const defaultNode = nodeAtPath(ast, ['default']) as ObjectNode;

        const settingIds =
          settingsNode?.children?.map((child: ValueNode) => {
            const idNode = (child as ObjectNode).children?.find(
              (prop: PropertyNode) => prop.key.value === 'id',
            );
            return idNode?.value && 'value' in idNode.value ? idNode.value.value : undefined;
          }) ?? [];

        const defaultSettingsIds =
          (
            defaultNode?.children?.find((child: PropertyNode) => child.key.value === 'settings')
              ?.value as ObjectNode
          )?.children?.map((child: PropertyNode) => ({
            key: child.key.value,
            start: child.loc!.start,
            end: child.loc!.end,
          })) ?? [];
        const presetSettingsIds = presetNode ? getNestedSettingIds(presetNode) : [];

        for (const presetSettingId of presetSettingsIds) {
          if (!settingIds.includes(presetSettingId.key)) {
            context.report({
              startIndex: presetSettingId.start.offset,
              endIndex: presetSettingId.end.offset,
              message: `Preset setting "${presetSettingId.key}" does not exist in settings`,
            });
          }
        }

        for (const defaultSettingId of defaultSettingsIds) {
          if (!settingIds.includes(defaultSettingId.key)) {
            context.report({
              startIndex: defaultSettingId!.start.offset,
              endIndex: defaultSettingId!.end.offset,
              message: `Default setting "${defaultSettingId.key}" does not exist in settings`,
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

            const settingsNode = nodeAtPath(ast, ['settings']) as ArrayNode;
            if (!settingsNode?.children) return [];
            return settingsNode.children.map((settingObj: ValueNode) => {
              const idNode = (settingObj as ObjectNode).children.find(
                (prop: { key: { value: string } }) => prop.key.value === 'id',
              );
              return (idNode?.value as LiteralNode).value;
            });
          }),
        );

        let presetBlockSettingIds: { key: string; start: any; end: any }[] = [];
        await Promise.all(
          Object.values(presetLevelBlocks)
            .flat()
            .map(async ({ node }: BlockNodeWithPath) => {
              const blockNode = nodeAtPath(ast, ['presets', '0', 'blocks', '0']) as ValueNode;
              let settings: Setting.Values;
              if ('settings' in node) {
                settings = (node as Preset.Block).settings!;
              } else {
                const blockTypeKey = Object.keys(node)[0];
                settings = (node as { [key: string]: any })[blockTypeKey]?.settings!;
              }
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

        const defaultBlocks = defaultNode?.children?.find(
          (child: PropertyNode) => child.key.value === 'blocks',
        )?.value;

        const defaultBlockSettingIds: { key: string; start: any; end: any }[] = [];
        if (defaultBlocks && 'children' in defaultBlocks) {
          (defaultBlocks as ArrayNode).children.forEach((block: ValueNode) => {
            debugger;
            const settingsNode = extractBlockSettings(block as ObjectNode);
            if (settingsNode?.value && 'children' in settingsNode.value) {
              (settingsNode.value as ObjectNode).children.forEach((setting: PropertyNode) => {
                defaultBlockSettingIds.push({
                  key: setting.key.value,
                  start: setting.loc?.start,
                  end: setting.loc?.end,
                });
              });
            }
          });
        }

        for (const presetBlockSettingId of presetBlockSettingIds) {
          if (!rootLevelBlockSettingIds.flat().some((id) => id === presetBlockSettingId.key)) {
            context.report({
              startIndex: presetBlockSettingId!.start.offset,
              endIndex: presetBlockSettingId!.end.offset,
              message: `Preset block setting "${presetBlockSettingId.key}" does not exist in settings.`,
            });
          }
        }
        for (const defaultBlockSettingId of defaultBlockSettingIds) {
          if (!rootLevelBlockSettingIds.flat().some((id) => id === defaultBlockSettingId.key)) {
            context.report({
              startIndex: defaultBlockSettingId!.start.offset,
              endIndex: defaultBlockSettingId!.end.offset,
              message: `Default block setting "${defaultBlockSettingId.key}" does not exist in settings.`,
            });
          }
        }
      },
    };
  },
};
