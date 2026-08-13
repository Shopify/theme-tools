import {
  JSONCheckDefinition,
  LiquidCheckDefinition,
  Severity,
  SourceCodeType,
  Preset,
  Section,
  ThemeBlock,
  Template,
  JSONNode,
  Setting,
} from '../../types';
import { nodeAtPath } from '../../json';
import { getSchema, getSchemaFromJSON, isSectionSchema } from '../../to-schema';
import { BlockDefNodeWithPath, getBlocks, reportWarning } from '../../utils';

const meta = {
  code: 'ValidSettingsKey',
  name: 'Validate settings key in presets',
  docs: {
    description:
      'Ensures settings key only references valid settings defined in its respective schema',
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-settings-key',
  },
  severity: Severity.ERROR,
  schema: {},
  targets: [],
};

export const ValidSettingsKey: LiquidCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.LiquidHtml },

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

export const ValidSettingsKeyJSON: JSONCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.JSON },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (!relativePath.startsWith('templates/')) return {};

    return {
      async onCodePathEnd() {
        const schema = await getSchemaFromJSON(context);
        const { ast } = schema ?? {};
        if (!schema || !ast || ast instanceof Error) return;

        const sections = schema.parsed.sections;
        if (!sections) return;

        await Promise.all(
          Object.entries(sections).map(async ([sectionKey, section]) => {
            if (!isPropertyNode(section) || !('type' in section)) {
              return;
            }

            const sectionSchema = await context.getSectionSchema?.(section.type);
            const { validSchema } = sectionSchema ?? {};
            if (!validSchema || validSchema instanceof Error) return;

            if ('settings' in section) {
              const settingsNode = nodeAtPath(ast, ['sections', sectionKey, 'settings']);
              validateSettingsKey(
                context,
                0,
                settingsNode,
                validSchema.settings,
                undefined,
                `'sections/${section.type}.liquid'`,
              );
            }

            if ('blocks' in section && isPropertyNode(section.blocks)) {
              await validateTemplateBlocksSettings(
                context,
                ast,
                section.blocks,
                validSchema,
                ['sections', sectionKey, 'blocks'],
                `'sections/${section.type}.liquid'`,
              );
            }
          }),
        );
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

async function validateTemplateBlocksSettings(
  context: any,
  ast: JSONNode,
  blocks: Record<string, Template.Block>,
  parentSchema: Section.Schema | ThemeBlock.Schema,
  currentPath: string[],
  parentSchemaPath: string,
) {
  await Promise.all(
    Object.entries(blocks).map(async ([blockKey, block]) => {
      if (!isPropertyNode(block) || !('type' in block)) return;

      const currentBlockPath = currentPath.concat(blockKey);
      const localBlock = parentSchema.blocks?.find(
        (schemaBlock) => schemaBlock.type === block.type && 'name' in schemaBlock,
      ) as Section.LocalBlock | undefined;

      if (localBlock) {
        const settingsNode = nodeAtPath(ast, currentBlockPath.concat('settings'));
        validateSettingsKey(
          context,
          0,
          settingsNode,
          localBlock.settings,
          undefined,
          parentSchemaPath,
        );

        if ('blocks' in block && isPropertyNode(block.blocks)) {
          await validateTemplateBlocksSettings(
            context,
            ast,
            block.blocks,
            localBlock,
            currentBlockPath.concat('blocks'),
            parentSchemaPath,
          );
        }

        return;
      }

      const blockSchema = await context.getBlockSchema?.(block.type);
      const { validSchema } = blockSchema ?? {};
      if (!validSchema || validSchema instanceof Error) return;

      const settingsNode = nodeAtPath(ast, currentBlockPath.concat('settings'));
      validateSettingsKey(context, 0, settingsNode, validSchema.settings, block);

      if ('blocks' in block && isPropertyNode(block.blocks)) {
        await validateTemplateBlocksSettings(
          context,
          ast,
          block.blocks,
          validSchema,
          currentBlockPath.concat('blocks'),
          `'blocks/${block.type}.liquid'`,
        );
      }
    }),
  );
}

function validateSettingsKey(
  context: any,
  offset: number,
  settingsNode: JSONNode | undefined,
  validSettings: Setting.Any[] | undefined,
  blockNode?: Section.Block | ThemeBlock.Block | Preset.Block,
  schemaPath = 'schema',
) {
  if (!settingsNode || settingsNode.type !== 'Object') return;

  for (const setting of settingsNode.children) {
    const settingExists = validSettings?.find(
      (validSetting) => validSetting?.id === setting.key.value,
    );

    if (!settingExists) {
      const errorMessage = blockNode
        ? `Setting '${setting.key.value}' does not exist in 'blocks/${blockNode.type}.liquid'.`
        : `Setting '${setting.key.value}' does not exist in ${schemaPath}.`;

      reportWarning(errorMessage, offset, setting.key, context);
    }
  }
}

function isPropertyNode(node: unknown): node is Record<string, any> {
  return typeof node === 'object' && node !== null;
}
