import {
  JSONCheckDefinition,
  JSONNode,
  LiquidCheckDefinition,
  ObjectNode,
  Severity,
  SourceCodeType,
  isArrayNode,
  isLiteralNode,
  isObjectNode,
} from '../../types';
import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchema, isSectionSchema } from '../../to-schema';
import { BlockDefNodeWithPath, getBlocks } from '../../utils';

// Like ValidVisibleIf, this exports two checks with the same code: one for the {% schema %} of
// sections and blocks, and one for 'config/settings_schema.json'.

const meta = {
  code: 'ValidSelectDefault',
  name: 'Validate default values and preset values for select/radio settings',
  docs: {
    description:
      "Warns when a select/radio setting's default value (or a preset's setting value) is not one of the setting's declared options.",
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-select-default',
  },
  severity: Severity.WARNING,
  schema: {},
  targets: [],
};

export const ValidSelectDefault: LiquidCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.LiquidHtml },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const schema = await getSchema(context);
        const { validSchema, ast } = schema ?? {};
        if (!validSchema || validSchema instanceof Error) return;
        if (!ast || ast instanceof Error) return;

        const offset = node.blockStartPosition.end;
        const report: Report = (message, node) =>
          context.report({
            message,
            startIndex: offset + getLocStart(node),
            endIndex: offset + getLocEnd(node),
          });

        const settings = nodeAtPath(ast, ['settings']);
        const { rootLevelLocalBlocks, presetLevelBlocks } = getBlocks(validSchema);

        // The defaults of the file's settings, and of its local blocks' settings.
        checkDefaults(settings, report);
        for (const { path } of rootLevelLocalBlocks) {
          checkDefaults(nodeAtPath(ast, settingsPath(path)), report);
        }

        // The values presets give the file's settings.
        for (let i = 0; i < (validSchema.presets?.length ?? 0); i++) {
          checkValues(nodeAtPath(ast, ['presets', i, 'settings']), settings, report);
        }

        // The values presets and section defaults give their blocks' settings.
        const checkBlock = async (path: string[], type: unknown) => {
          const blockSettings = await referencedBlockSettings(
            context,
            ast,
            rootLevelLocalBlocks,
            type,
          );
          checkValues(nodeAtPath(ast, settingsPath(path)), blockSettings, report);
        };

        for (const blocks of Object.values(presetLevelBlocks)) {
          await Promise.all(blocks.map(({ node, path }) => checkBlock(path, node.type)));
        }

        if (isSectionSchema(schema) && 'default' in validSchema && validSchema.default) {
          checkValues(nodeAtPath(ast, ['default', 'settings']), settings, report);
          await Promise.all(
            (validSchema.default.blocks ?? []).map((block, i) =>
              checkBlock(['default', 'blocks', String(i), 'type'], block.type),
            ),
          );
        }
      },
    };
  },
};

export const ValidSelectDefaultSettingsSchema: JSONCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.JSON },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (relativePath !== 'config/settings_schema.json') return {};

    const report: Report = (message, node) =>
      context.report({ message, startIndex: getLocStart(node), endIndex: getLocEnd(node) });

    return {
      async Property(node) {
        if (node.key.value !== 'settings') return;
        checkDefaults(node.value, report);
      },
    };
  },
};

type Report = (message: string, node: JSONNode) => void;

/** Reports each select/radio setting in `settings` whose default isn't one of its options. */
function checkDefaults(settings: JSONNode | undefined, report: Report) {
  if (!isArrayNode(settings)) return;

  for (const setting of settings.children) {
    if (!isObjectNode(setting)) continue;
    const id = literal(setting, 'id');
    const options = choiceOptions(setting);
    const defaultNode = setting.children.find((p) => p.key.value === 'default')?.value;
    if (typeof id !== 'string' || !options || !isLiteralNode(defaultNode)) continue;

    const value = defaultNode.value;
    if (isScalar(value) && !options.includes(String(value))) {
      report(
        `Default value ${JSON.stringify(value)} for setting "${id}" is not one of the valid options: ${list(options)}.`,
        defaultNode,
      );
    }
  }
}

/**
 * Reports each value in `values`, an object of setting values by id, that isn't one of the
 * options of the select/radio setting it sets in `settings`.
 */
function checkValues(values: JSONNode | undefined, settings: JSONNode | undefined, report: Report) {
  if (!isObjectNode(values) || !isArrayNode(settings)) return;

  for (const property of values.children) {
    const id = property.key.value;
    const setting = settings.children.find(
      (setting): setting is ObjectNode => isObjectNode(setting) && literal(setting, 'id') === id,
    );
    const options = setting && choiceOptions(setting);
    const valueNode = property.value;
    if (!options || !isLiteralNode(valueNode)) continue;

    const value = valueNode.value;
    if (isScalar(value) && !options.includes(String(value))) {
      report(
        `Value ${JSON.stringify(value)} for setting "${id}" is not one of the valid options: ${list(options)}.`,
        valueNode,
      );
    }
  }
}

/** The settings of the block a preset or section default uses, from its schema. */
async function referencedBlockSettings(
  context: Parameters<LiquidCheckDefinition['create']>[0],
  ast: JSONNode,
  localBlocks: BlockDefNodeWithPath[],
  type: unknown,
): Promise<JSONNode | undefined> {
  // A section with local blocks can only use those.
  if (localBlocks.length > 0) {
    const localBlock = localBlocks.find((block) => block.node.type === type);
    return localBlock && nodeAtPath(ast, settingsPath(localBlock.path));
  }

  if (typeof type !== 'string') return;
  const blockSchema = await context.getBlockSchema?.(type);
  const { validSchema, ast: blockAst } = blockSchema ?? {};
  if (!validSchema || validSchema instanceof Error) return;
  if (!blockAst || blockAst instanceof Error) return;
  return nodeAtPath(blockAst, ['settings']);
}

/** The option values of a select or radio setting, or undefined for any other setting. */
function choiceOptions(setting: ObjectNode): string[] | undefined {
  const type = literal(setting, 'type');
  if (type !== 'select' && type !== 'radio') return;

  const options = setting.children.find((p) => p.key.value === 'options')?.value;
  if (!isArrayNode(options)) return;

  return options.children.flatMap((option) => {
    const value = isObjectNode(option) ? literal(option, 'value') : undefined;
    return isScalar(value) ? [String(value)] : [];
  });
}

/** The value of `object[key]` when it's a literal. */
function literal(object: ObjectNode, key: string): unknown {
  const value = object.children.find((p) => p.key.value === key)?.value;
  return isLiteralNode(value) ? value.value : undefined;
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function list(options: string[]) {
  return options.map((option) => `"${option}"`).join(', ');
}

/** The path of a block's `settings`, from the path of its `type`. */
function settingsPath(typePath: string[]) {
  return typePath.slice(0, -1).concat('settings');
}
