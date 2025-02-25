import { type LiquidVariableLookup } from '@shopify/liquid-html-parser';
import {
  Severity,
  SourceCodeType,
  type LiquidCheckDefinition,
  type JSONCheckDefinition,
} from '../../types';
import { getLocStart, nodeAtPath } from '../../json';
import { getSchema, isBlockSchema, isSectionSchema } from '../../to-schema';
import { reportOnJsonNode } from '../../utils';
import {
  getGlobalSettings,
  getVariableLookupsInExpression,
  lookupIsError,
  validateLookupErrors,
  offsetAdjust,
  type Vars,
  buildLiquidLookupReport,
  lookupIsWarning,
  validateLookupWarnings,
} from '../../utils/visible-if-utils';

// Note that unlike most other files in the `checks` directory, this exports two
// checks: one for Liquid files and one for 'config/settings_schema.json'. They
// perform the same check using the same logic (modulo differences extracting
// the schema and determining warning start and end indices).

const meta = {
  code: 'VisibleIfUsage',
  name: 'Validate visible_if expressions',
  docs: {
    description: 'Ensures visible_if expressions are defined with recommended usage patterns.',
    recommended: true,
    url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-visible-if',
  },
  severity: Severity.WARNING,
  schema: {},
  targets: [],
};

export const VisibleIfUsage: LiquidCheckDefinition = {
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

        const allGlobalSettings = await getGlobalSettings(context);
        const settings = Object.fromEntries(
          (await getGlobalSettings(context)).map((s) => [s.id, s.type] as const),
        );
        const currentFileSettings = Object.fromEntries(
          validSchema.settings.map((setting) => [setting.id, setting.type] as const),
        );
        // TODO get the types from these settings ^

        const vars: Vars = { settings };
        if (isSectionSchema(schema)) {
          vars.section = { settings: currentFileSettings };
        } else if (isBlockSchema(schema)) {
          vars.block = { settings: currentFileSettings };
        }

        const offset = node.blockStartPosition.end;
        for (const [i, setting] of validSchema.settings.entries()) {
          if (!('visible_if' in setting) || typeof setting.visible_if !== 'string') continue;

          const visibleIfNode = nodeAtPath(ast, ['settings', i, 'visible_if'])!;

          const varLookups = getVariableLookupsInExpression(setting.visible_if);
          if (lookupIsError(varLookups)) {
            // Skip validation errors from the expression parsing.
            // Those errors will be reported in the ValidVisibleIf check.
            continue;
          }

          if (lookupIsWarning(varLookups)) {
            reportOnJsonNode(varLookups.warning, offset, visibleIfNode, context);
            continue;
          }

          const report = buildLiquidLookupReport(context, offset, visibleIfNode);

          for (const lookup of varLookups) {
            if (
              (lookup.name === 'section' && !isSectionSchema(schema)) ||
              (lookup.name === 'block' && !isBlockSchema(schema))
            ) {
              // Skip validation on the var lookups when there is any errors present.
              // Those errors will be reported in the ValidVisibleIf check.
              continue;
            } else {
              report(validateLookupWarnings(lookup, vars), lookup);
            }
          }
        }
      },
    };
  },
};

// export const VisibleIfUsageSettingsSchema: JSONCheckDefinition = {
//   meta: { ...meta, type: SourceCodeType.JSON },

//   create(context) {
//     const relativePath = context.toRelativePath(context.file.uri);
//     if (relativePath !== 'config/settings_schema.json') return {};

//     return {
//       async Property(node) {
//         if (node.key.value !== 'visible_if' || node.value.type !== 'Literal') return;
//         const visibleIfExpression = node.value.value;
//         if (typeof visibleIfExpression !== 'string') return;
//         const offset = node.value.loc.start.offset;

//         const varLookups = getVariableLookupsInExpression(visibleIfExpression);
//         if (lookupIsError(varLookups)) {
//           context.report({
//             message: varLookups.error,
//             startIndex: node.value.loc.start.offset,
//             endIndex: node.value.loc.end.offset,
//           });
//           return;
//         }

//         const settings = Object.fromEntries(
//           (await getGlobalSettings(context)).map((s) => [s.id, true] as const),
//         );

//         const vars: Vars = { settings };

//         const report = (message: string | null, lookup: LiquidVariableLookup) => {
//           if (typeof message === 'string') {
//             context.report({
//               message,
//               startIndex: offset + lookup.position.start + offsetAdjust + 1,
//               endIndex: offset + lookup.position.end + offsetAdjust + 1,
//             });
//           }
//         };

//         for (const lookup of varLookups) {
//           // settings_schema.json can't reference `section` or `block`.
//           if (lookup.name === 'section') {
//             report(
//               `Invalid visible_if: can't refer to "section" when not in a section file.`,
//               lookup,
//             );
//           } else if (lookup.name === 'block') {
//             report(`Invalid visible_if: can't refer to "block" when not in a block file.`, lookup);
//           } else {
//             report(validateLookupErrors(lookup, vars), lookup);
//           }
//         }
//       },
//     };
//   },
// };
