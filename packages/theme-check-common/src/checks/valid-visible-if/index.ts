import { toLiquidHtmlAST, type LiquidVariableLookup, NodeTypes } from '@shopify/liquid-html-parser';
import {
  Severity,
  SourceCodeType,
  type LiquidCheckDefinition,
  type JSONCheckDefinition,
  type Context,
} from '../../types';
import { getLocStart, nodeAtPath, parseJSON } from '../../json';
import { getSchema, isBlockSchema, isSectionSchema } from '../../to-schema';
import { reportWarning } from '../../utils';
import { visit } from '../../visitor';
import { findRoot } from '../../find-root';
import { join } from '../../path';

type Vars = { [key: string]: Vars | true };

const variableExpressionMatcher = /{{(.+?)}}/;
const adjustedPrefix = '{% if ';
const adjustedSuffix = ' %}{% endif %}';
const offsetAdjust = '{{'.length - adjustedPrefix.length;

// Note that unlike most other files in the `checks` directory, this exports two
// checks: one for Liquid files and one for 'config/settings_schema.json'. They
// perform the same check using the same logic (modulo differences extracting
// the schema and determining warning start and end indices).

const meta = {
  code: 'ValidVisibleIf',
  name: 'Validate settings keys in visible_if expressions',
  docs: {
    description: 'Ensures visible_if expressions only reference settings keys that are defined',
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-visible-if',
  },
  severity: Severity.ERROR,
  schema: {},
  targets: [],
};

export const ValidVisibleIf: LiquidCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.LiquidHtml },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;

        const schema = await getSchema(context);

        const { validSchema, ast } = schema ?? {};
        if (
          !validSchema ||
          validSchema instanceof Error ||
          !validSchema.settings?.some((setting) => 'visible_if' in setting) ||
          !ast ||
          ast instanceof Error
        ) {
          return;
        }

        const offset = node.blockStartPosition.end;
        const settings = Object.fromEntries(
          (await getGlobalSettings(context)).map((s) => [s, true] as const),
        );
        const currentFileSettings = Object.fromEntries(
          validSchema.settings.map((setting) => [setting.id, true] as const),
        );

        const vars: Vars = { settings };
        if (isSectionSchema(schema)) {
          vars.section = { settings: currentFileSettings };
        } else if (isBlockSchema(schema)) {
          vars.block = { settings: currentFileSettings };
        }

        for (const [i, setting] of validSchema.settings.entries()) {
          if (!('visible_if' in setting) || typeof setting.visible_if !== 'string') continue;

          const visibleIfNode = nodeAtPath(ast, ['settings', i, 'visible_if'])!;

          const varLookupsOrWarning = getVariableLookupsInExpression(setting.visible_if);
          if ('warning' in varLookupsOrWarning) {
            reportWarning(varLookupsOrWarning.warning, offset, visibleIfNode, context);
            continue;
          }

          const report = (message: string | null, lookup: LiquidVariableLookup) => {
            if (typeof message === 'string') {
              context.report({
                message,
                // the JSONNode start location returned by `getLocStart`
                // includes the opening quotation mark — whereas when we parse
                // the inner expression, 0 is the location _inside_ the quotes.
                // we add 1 to the offsets to compensate.
                startIndex:
                  offset + getLocStart(visibleIfNode) + lookup.position.start + offsetAdjust + 1,
                endIndex:
                  offset + getLocStart(visibleIfNode) + lookup.position.end + offsetAdjust + 1,
              });
            }
          };

          for (const lookup of varLookupsOrWarning) {
            if (lookup.name === 'section' && !isSectionSchema(schema)) {
              report(
                `Invalid visible_if: can't refer to "section" when not in a section file.`,
                lookup,
              );
            } else if (lookup.name === 'block' && !isBlockSchema(schema)) {
              report(
                `Invalid visible_if: can't refer to "block" when not in a block file.`,
                lookup,
              );
            } else {
              report(validateLookup(lookup, vars), lookup);
            }
          }
        }
      },
    };
  },
};

export const ValidVisibleIfSettingsSchema: JSONCheckDefinition = {
  meta: { ...meta, type: SourceCodeType.JSON },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (relativePath !== 'config/settings_schema.json') return {};

    return {
      async Property(node) {
        if (node.key.value !== 'visible_if' || node.value.type !== 'Literal') return;
        const visibleIfExpression = node.value.value;
        if (typeof visibleIfExpression !== 'string') return;
        const offset = node.value.loc.start.offset;

        const varLookupsOrWarning = getVariableLookupsInExpression(visibleIfExpression);
        if ('warning' in varLookupsOrWarning) {
          context.report({
            message: varLookupsOrWarning.warning,
            startIndex: node.value.loc.start.offset,
            endIndex: node.value.loc.end.offset,
          });
          return;
        }

        const settings = Object.fromEntries(
          (await getGlobalSettings(context)).map((s) => [s, true] as const),
        );

        const vars: Vars = { settings };

        const report = (message: string | null, lookup: LiquidVariableLookup) => {
          if (typeof message === 'string') {
            context.report({
              message,
              startIndex: offset + lookup.position.start + offsetAdjust + 1,
              endIndex: offset + lookup.position.end + offsetAdjust + 1,
            });
          }
        };

        for (const lookup of varLookupsOrWarning) {
          if (lookup.name === 'section') {
            report(
              `Invalid visible_if: can't refer to "section" when not in a section file.`,
              lookup,
            );
          } else if (lookup.name === 'block') {
            report(`Invalid visible_if: can't refer to "block" when not in a block file.`, lookup);
          } else {
            report(validateLookup(lookup, vars), lookup);
          }
        }
      },
    };
  },
};

async function getGlobalSettings(context: Context<SourceCodeType>) {
  const globalSettings: string[] = [];

  try {
    const path = join(
      await findRoot(context.file.uri, context.fileExists),
      'config/settings_schema.json',
    );
    const settingsFile = await context.fs.readFile(path);
    const settings = parseJSON(settingsFile);
    if (Array.isArray(settings)) {
      for (const group of settings) {
        if ('settings' in group && Array.isArray(group.settings)) {
          globalSettings.push(
            ...group.settings.map((setting: any) => setting.id).filter((id: any) => id),
          );
        }
      }
    }
  } catch (e) {
    console.error('Error fetching global settings:', e);
    // ignore absent or malformed settings schema
  }

  return globalSettings;
}

function getVariableLookupsInExpression(
  expression: string,
): LiquidVariableLookup[] | { warning: string } {
  // parsers other than liquidjs don't yet support expressions in {{ variable }}
  // tags. so we have to do something a little gnarly...
  const match = variableExpressionMatcher.exec(expression);
  if (match == null) {
    return {
      warning: `Invalid visible_if expression. It should take the form "{{ <expression> }}".`,
    };
  }
  const unwrappedExpression = match[1];

  const adjustedExpression = `${adjustedPrefix}${unwrappedExpression}${adjustedSuffix}`;

  try {
    const innerAst = toLiquidHtmlAST(adjustedExpression);

    if (innerAst.children.length !== 1) {
      throw new Error('Unexpected child count for DocumentNode');
    }

    const ifTag = innerAst.children[0];

    if (ifTag.type !== 'LiquidTag' || ifTag.name !== 'if') {
      throw new Error("Expected DocumentNode to contain 'if' tag");
    }

    const vars = visit<SourceCodeType.LiquidHtml, LiquidVariableLookup>(ifTag, {
      VariableLookup: (node) => node,
    });

    if (vars.length === 0) {
      return {
        warning: `visible_if expression contains no references to any settings. This is likely an error.`,
      };
    }

    return vars;
  } catch (error) {
    return { warning: String(error) };
  }
}

function validateLookup(lookup: LiquidVariableLookup, vars: Vars): string | null {
  const normalized = getNormalizedLookups(lookup);

  const poppedSegments = [];
  let scope = vars;
  while (normalized.length > 0) {
    const segment = normalized.shift()!;
    poppedSegments.push(segment);

    // "noUncheckedIndexedAccess" is false in our tsconfig.json
    const next = scope[segment] as true | Vars | undefined;

    if (!next) {
      return `Invalid variable: "${poppedSegments.join('.')}" was not found.`;
    }

    if (typeof next === 'boolean') {
      if (normalized.length > 0) {
        return `Invalid variable: "${poppedSegments.join(
          '.',
        )}" refers to a variable, but is being used here as a namespace.`;
      }
      return null;
    }

    scope = next;
  }

  // note this is the reverse of the above similar-looking case
  return `Invalid variable: "${poppedSegments.join(
    '.',
  )}" refers to a namespace, but is being used here as a variable.`;
}

function getNormalizedLookups(lookup: LiquidVariableLookup) {
  const nestedLookups = lookup.lookups.map((l) => {
    if (l.type !== NodeTypes.String) {
      throw new Error(`Expected lookups to be String nodes: ${JSON.stringify(lookup)}`);
    }
    return l.value;
  });

  return [lookup.name, ...nestedLookups];
}
