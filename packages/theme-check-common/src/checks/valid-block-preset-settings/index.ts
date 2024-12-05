import { isSection, isBlock } from '../../to-schema';
import { basename } from '../../path';
import { LiquidCheckDefinition, Severity, SourceCodeType, ThemeBlock } from '../../types';
import { Preset } from '../../types/schemas/preset';
import { Setting } from '../../types/schemas/setting';
import { isError } from '../../utils/error';
import { nodeAtPath } from '../../json';
import { ObjectNode, PropertyNode } from 'json-to-ast';
import { BlockNodeWithPath, getBlocks } from '../valid-block-target/block-utils';

export const ValidBlockPresetSettings: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockPresetSettings',
    name: 'Reports invalid preset settings for a block',
    docs: {
      description: 'Reports invalid preset settings for a block',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-preset-settings',
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

    return {
      async LiquidRawTag() {
        const schema = await getSchema();
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;
        if (!schema) return;

        const presetNode = nodeAtPath(ast, ['presets']) as ObjectNode;
        if (!presetNode) return;

        const settingsNode = nodeAtPath(ast, ['settings']) as ObjectNode;
        if (!settingsNode) return;

        const presetSettingsIds = presetNode.children
          .map((preset: PropertyNode) => {
            const settingsNode = preset.children.find(
              (prop: PropertyNode) => prop.key.value === 'settings',
            );
            if (settingsNode?.value?.children) {
              return settingsNode.value.children.map((setting: PropertyNode) => {
                const key = setting.key.value;
                const start = setting.key.loc?.start;
                const end = setting.key.loc?.end;
                return { key, start, end };
              });
            }
            return [];
          })
          .flat()
          .filter(Boolean);

        const settingIds = settingsNode.children.map((child: PropertyNode) => {
          const idNode = child.children.find((prop: PropertyNode) => prop.key.value === 'id');
          return idNode?.value?.value; // Access the actual ID string
        });


        for (const presetSettingId of presetSettingsIds) {
          if (!settingIds.includes(presetSettingId.key)) {
            context.report({
              startIndex: presetSettingId.start.line,
              endIndex: presetSettingId.end.line,
              message: `Preset setting "${presetSettingId.key}" does not exist in settings`,
            });
          }
        }

        const { rootLevelThemeBlocks, rootLevelLocalBlocks, presetLevelBlocks } =
          getBlocks(validSchema);


          const rootLevelThemeBlockSettingIds = await Promise.all(
            rootLevelThemeBlocks.map(async ({ node }) => {
              const blockSchema = await context.getBlockSchema?.(node.type);
              const { validSchema, ast } = blockSchema ?? {};
              
              if (!validSchema || validSchema instanceof Error) return [];
              if (!ast || ast instanceof Error) return [];
  
              const settingsNode = nodeAtPath(ast, ['settings']) as ObjectNode;
              if (!settingsNode?.children) return [];
  
              return settingsNode.children
                .map((child: PropertyNode) => {
                  const idNode = child.children?.find(
                    (prop: PropertyNode) => prop.key.value === 'id'
                  );
                  return idNode?.value?.value;
                })
                .filter(Boolean);
            })
          );

          const rootLevelLocalBlockSettingIds = await Promise.all(rootLevelLocalBlocks
            .map(async ({ node }) => {
              if (!node.settings) {
                const blockType = node.type;
                const blockSchema = await context.getBlockSchema?.(blockType);
                const { validSchema, ast } = blockSchema ?? {};
                
                if (!validSchema || validSchema instanceof Error) return [];
                if (!ast || ast instanceof Error) return [];
  
                const settingsNode = nodeAtPath(ast, ['settings']) as ObjectNode;
                if (!settingsNode?.children) return [];
  
                return settingsNode.children
                  .map((child: PropertyNode) => {
                    const idNode = child.children?.find(
                      (prop: PropertyNode) => prop.key.value === 'id'
                    );
                    return idNode?.value?.value;
                  })
                  .filter(Boolean);
              }
              return Object.keys(node.settings);
            }))
            .then(ids => ids.flat());
            console.log(rootLevelLocalBlockSettingIds);

        //one array to compare against
        const allBlockSettingIds = [
          ...rootLevelThemeBlockSettingIds,
          ...rootLevelLocalBlockSettingIds
        ].flat();
        
        console.log(allBlockSettingIds);
         //we check this against the other two arrays
         const presetBlockSettingIds = Object.values(presetLevelBlocks)
         .flat()
         .map(({ node }) => {
           const blockKey = Object.keys(node).find(
             (key) => node[key as keyof typeof node]?.settings,
           );
           if (!blockKey) return [];

           const blockSettingsNode = nodeAtPath(ast, [
             'presets',
             '0',
             'blocks',
             '0',
             blockKey,
             'settings',
           ]) as ObjectNode;
           if (!blockSettingsNode?.children) return [];

           return blockSettingsNode.children
             .filter((node): node is PropertyNode => 'key' in node)
             .map((setting) => ({
               key: setting.key.value,
               start: setting.key.loc?.start,
               end: setting.key.loc?.end,
             }));
         })
         .flat()
         .filter(Boolean);

        
        for (const presetBlockSettingId of presetBlockSettingIds) {
          if (!allBlockSettingIds.includes(presetBlockSettingId.key)) {
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
