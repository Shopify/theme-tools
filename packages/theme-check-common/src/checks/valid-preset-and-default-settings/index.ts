import { isSection, isBlock } from '../../to-schema';
import { basename } from '../../path';
import {
  ArrayNode,
  LiquidCheckDefinition,
  LiteralNode,
  ObjectNode,
  Preset,
  PropertyNode,
  Section,
  Setting,
  Severity,
  SourceCodeType,
  ThemeBlock,
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

    const extractBlockSettings = (block: PropertyNode) => {
      let settingsNode;

      if (block.value && 'children' in block.value) {
        settingsNode = (block.value as ObjectNode).children?.find(
          (child: PropertyNode) => child.key.value === 'settings',
        );
      } else {
        settingsNode = block.children?.find(
          (child: PropertyNode) => child.key.value === 'settings',
        );
      }

      return settingsNode;
    };


    const getNestedSettingIds = (node: ObjectNode) => {
      // console.log("Node", node.type);
      // console.log("NodeChildren", node.children);
      return node.children
        .map((node: PropertyNode) => {
          // console.log("PropertyChildren", node.children[0]);
          const settingsNode = node.children!.find(
            (prop: PropertyNode) => prop.key.value === 'settings',
          );
          console.log("SettingsNode", settingsNode);
          console.log("SettingsNode", settingsNode?.value?.type);
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

        const settingsNode = nodeAtPath(ast, ['settings']) as ObjectNode;
        const presetNode = nodeAtPath(ast, ['presets']) as ObjectNode;
        const defaultNode = nodeAtPath(ast, ['default']) as ObjectNode;

        const settingIds =
          settingsNode?.children?.map((child: PropertyNode) => {
            const idNode = child.children?.find((prop: PropertyNode) => prop.key.value === 'id');
            return idNode?.value && 'value' in idNode.value ? idNode.value.value : undefined;
          }) ?? [];

        const defaultSettingsIds =
          (defaultNode?.children
            ?.find((child: PropertyNode) => child.key.value === 'settings')
            ?.value as ObjectNode)?.children?.map((child: PropertyNode) => ({
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

            const settingsNode = nodeAtPath(ast, ['settings']) as ObjectNode;
            if (!settingsNode?.children) return [];
            return settingsNode.children
              .map((settingObj: PropertyNode) => {
                const idNode = settingObj.children.find(
                  (prop: { key: { value: string } }) => prop.key.value === 'id',
                );
                return idNode?.value?.value;
              })
              .filter((id: string): id is string => Boolean(id));
          }),
        );

        let presetBlockSettingIds: { key: string; start: any; end: any }[] = [];
        await Promise.all(
          Object.values(presetLevelBlocks)
            .flat()
            .map(async ({ node, path }: BlockNodeWithPath) => {
              const blockNode = nodeAtPath(ast, ['presets', '0', 'blocks', '0']) as ValueNode;
              console.log("Node", node);
              console.log("Path", path);
              console.log("Ast", ast);
              console.log("BlockNode", blockNode);
              debugger;
              let settings: Setting.Values;
              if ('settings' in node) {
                settings = (node as Preset.Block).settings!;
              } else {
                const blockTypeKey = Object.keys(node)[0];
                settings = ((node as { [key: string]: any })[blockTypeKey])?.settings!;
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
            })
        );

        const defaultBlockSettingIds: { key: string; start: any; end: any }[] = [];
        const defaultBlocks = defaultNode?.children?.find(
          (child: PropertyNode) => child.key.value === 'blocks',
        )?.value;

        if (defaultBlocks && 'children' in defaultBlocks) {
          defaultBlocks.children.forEach((block: PropertyNode | ValueNode) => {
            const settingsNode = extractBlockSettings(block as PropertyNode);

            if (settingsNode?.value && 'children' in settingsNode.value) {
              settingsNode.value.children.forEach((setting: PropertyNode) => {
                defaultBlockSettingIds.push({
                  key: setting.key.value,
                  start: setting.loc?.start,
                  end: setting.loc?.end,
                });
              });
            }
          });
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

        for (const presetBlockSettingId of presetBlockSettingIds) {
          if (!rootLevelBlockSettingIds.flat().some((id) => id === presetBlockSettingId.key)) {
            context.report({
              startIndex: presetBlockSettingId!.start.offset,
              endIndex: presetBlockSettingId!.end.offset,
              message: `Preset block setting "${presetBlockSettingId.key}" does not exist in settings.`,
            });
          }
        }
      },
    };
  },
};
