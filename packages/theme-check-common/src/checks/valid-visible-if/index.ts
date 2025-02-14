import {
  toLiquidHtmlAST,
  toLiquidAST,
  type LiquidVariableLookup,
  NodeTypes,
  type LiquidString,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType, type Context } from '../../types';
import { nodeAtPath, parseJSON } from '../../json';
import { getSchema, isBlockSchema, isSectionSchema } from '../../to-schema';
import { reportWarning } from '../../utils';
import { visit } from '../../visitor';
import { findRoot } from '../../find-root';
import { join } from '../../path';

const variableExpressionMatcher = /{{(.+?)}}/;

// TODO: also perform analysis for json files?

export const ValidVisibleIf: LiquidCheckDefinition = {
  meta: {
    code: 'ValidVisibleIf',
    name: 'Validate settings keys in visible_if expressions',
    docs: {
      description: 'Ensures visible_if expressions only reference settings keys that are defined',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-visible-if',
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
        if (!validSchema || validSchema instanceof Error || !validSchema.settings) return;
        if (!ast || ast instanceof Error) return;

        const globalSettings = new Set(await getGlobalSettings(context));
        const currentFileSettings = new Set(validSchema.settings.map((setting) => setting.id));

        for (const [i, setting] of validSchema.settings.entries()) {
          if (!('visible_if' in setting) || typeof setting.visible_if !== 'string') continue;

          const visibleIfNode = nodeAtPath(ast, ['settings', i, 'visible_if'])!;

          const varLookupsOrWarning = getVariableLookupsInExpression(setting.visible_if);
          if ('warning' in varLookupsOrWarning) {
            reportWarning(varLookupsOrWarning.warning, offset, visibleIfNode, context);
            continue;
          }

          const report = (maybeWarning: string | null) => {
            if (typeof maybeWarning === 'string') {
              reportWarning(maybeWarning, offset, visibleIfNode, context);
            }
          };

          for (const lookup of varLookupsOrWarning) {
            if (lookup.name === 'section') {
              if (isSectionSchema(schema)) {
                report(validateLookup(lookup, ['settings'], currentFileSettings));
              } else {
                report(
                  `Invalid visible_if variable: can't refer to "section" when not in a section file.`,
                );
              }
            } else if (lookup.name === 'block') {
              if (isBlockSchema(schema)) {
                report(validateLookup(lookup, ['settings'], currentFileSettings));
              } else {
                report(
                  `Invalid visible_if variable: can't refer to "block" when not in a block file.`,
                );
              }
            } else if (lookup.name === 'settings') {
              report(validateLookup(lookup, [], globalSettings));
            }

            // the `undefined-object` rule already handles other lookups.
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

  const prefix = '{% if ';
  const suffix = ' %}{% endif %}';
  const adjustedExpression = `${prefix}${unwrappedExpression}${suffix}`;

  const offsetAdjustment = prefix.length - '{{'.length;

  const innerAst = toLiquidAST(adjustedExpression);

  if (innerAst.children.length !== 1) {
    throw new Error('Unexpected child count for DocumentNode');
  }

  const ifTag = innerAst.children[0];

  if (ifTag.type !== 'LiquidTag' || ifTag.name !== 'if') {
    throw new Error("Expected DocumentNode to contain 'if' tag");
  }

  const vars = visit<SourceCodeType.LiquidHtml, LiquidVariableLookup>(ifTag, {
    // TODO: remap range
    VariableLookup: (node) => ({ ...node }),
  });

  return vars;
}

function validateLookup(
  lookup: LiquidVariableLookup,
  prefix: string[],
  vars: Set<string>,
): string | null {
  if (lookup.lookups.length === 0) {
    return `"${lookup.name}" can't be used as a variable directly. Try "${
      lookup.name
    }.${prefix.join('.')}.some_setting_name".`;
  }

  const notFound = () =>
    `Invalid variable: "${lookup.name}.${lookup.lookups
      .map((l) => (l as LiquidString).value)
      .join('.')}" was not found.`;

  const nestedLookups = [...lookup.lookups];
  while (prefix.length > 0 && nestedLookups.length > 0) {
    const expectedSegment = prefix.shift()!;
    const actualSegment = (nestedLookups.shift() as LiquidString).value;
    if (expectedSegment !== actualSegment) return notFound();
  }
  if (prefix.length !== 0 || nestedLookups.length !== 1) {
    return notFound();
  }

  if (!vars.has((nestedLookups[0] as LiquidString).value)) {
    return notFound();
  }

  return null;
}
