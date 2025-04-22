import { type LiquidVariableLookup } from '@shopify/liquid-html-parser';
import {
  Severity,
  SourceCodeType,
  type LiquidCheckDefinition,
  type JSONCheckDefinition,
} from '../../types';
import { getLocStart, nodeAtPath } from '../../json';
import { getSchema, isBlockSchema, isSectionSchema } from '../../to-schema';
import { reportWarning } from '../../utils';
import {
  getGlobalSettings,
  getVariableLookupsInExpression,
  validateLookup,
  offsetAdjust,
  type Vars,
} from './visible-if-utils';

// Note that unlike most other files in the `checks` directory, this exports two
// checks: one for Liquid files and one for 'config/settings_schema.json'. They
// perform the same check using the same logic (modulo differences extracting
// the schema and determining warning start and end indices).

const meta = {
  code: 'ValidVisibleIf',
  name: 'Validate visible_if expressions',
  docs: {
    description:
      'Ensures visible_if expressions are well-formed and only reference settings keys that are defined',
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
          if (varLookupsOrWarning === null) continue;

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
            if (lookup.name === 'section' && isBlockSchema(schema)) {
              //no-op, we don't know what section this block will be used in, so we can't validate that the setting exists
            } else if (lookup.name === 'section' && !isSectionSchema(schema)) {
              report(
                `Invalid visible_if: can't refer to "section" when not in a section or block file.`,
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
        if (varLookupsOrWarning === null) return;

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
          // settings_schema.json can't reference `section` or `block`.
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
