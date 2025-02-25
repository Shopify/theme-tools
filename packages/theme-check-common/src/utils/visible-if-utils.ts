import { type LiquidVariableLookup, toLiquidHtmlAST, NodeTypes } from '@shopify/liquid-html-parser';
import get from 'lodash/get';
import type { Context, JSONNode, SourceCodeType } from '..';
import { findRoot } from '../find-root';
import { parseJSON, getLocStart } from '../json';
import { join } from '../path';
import { visit } from '../visitor';
import { Setting } from '../types/schemas/setting';
export type Vars = { [key: string]: Vars | true | string };
type LookupError = { error: string };
type LookupWarning = { warning: string };
type LookupResult = LiquidVariableLookup[] | LookupError | LookupWarning;

export const variableExpressionMatcher = /{{(.+?)}}/;
export const adjustedPrefix = '{% if ';
export const adjustedSuffix = ' %}{% endif %}';
export const offsetAdjust = '{{'.length - adjustedPrefix.length;

export function lookupIsError(lookup: LookupResult): lookup is LookupError {
  return 'error' in lookup;
}

export function lookupIsWarning(lookup: LookupResult): lookup is LookupWarning {
  return 'warning' in lookup;
}

export function getVariableLookupsInExpression(expression: string): LookupResult {
  // As of February 2025, parsers other than LiquidJS don't yet support
  // expressions in {{ variable }} tags. So we have to do something a little
  // gnarly — before parsing it we extract the expression from within the tag
  // and plunk it into an `{% if <expression> %}{% endif %}` statement instead.
  // This requires us to adjust the reported character ranges and offer slightly
  // less useful messages on syntax errors, but otherwise should behave
  // similarly to a proper `{{ <expression> }}` syntax whenever it lands.
  const match = variableExpressionMatcher.exec(expression);
  if (match == null) {
    return {
      error: `Invalid visible_if expression. It should take the form "{{ <expression> }}".`,
    };
  }
  const unwrappedExpression = match[1];

  const adjustedExpression = `${adjustedPrefix}${unwrappedExpression}${adjustedSuffix}`;

  try {
    const innerAst = toLiquidHtmlAST(adjustedExpression, {
      mode: 'strict',
      allowUnclosedDocumentNode: false,
    });

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
        warning: `visible_if expression contains no references to any settings. This may be an error.`,
      };
    }

    return vars;
  } catch (error) {
    if (error instanceof SyntaxError) {
      // Because of our hackish approach, the underlying error is likely to
      // include an incorrect character range and/or mention {% if %} tags.
      // Squelch the details and just report it as a simple syntax error.
      return { error: 'Syntax error: cannot parse visible_if expression.' };
    }

    return { error: String(error) };
  }
}

export function validateLookupErrors(lookup: LiquidVariableLookup, vars: Vars): string | null {
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

export function validateLookupWarnings(lookup: LiquidVariableLookup, vars: Vars): string | null {
  const normalized = getNormalizedLookups(lookup);
  const settingType = get(vars, normalized);

  if (
    typeof settingType === 'string' &&
    (settingType === Setting.Type.Richtext ||
      settingType === Setting.Type.InlineRichtext ||
      settingType === Setting.Type.Html ||
      settingType === Setting.Type.Text ||
      settingType === Setting.Type.Textarea)
  ) {
    return `It is not recommended to use a ${settingType} setting in a visible_if expression.`;
  }

  return null;
}

function getNormalizedLookups(lookup: LiquidVariableLookup) {
  const nestedLookups = lookup.lookups.map((lookup) => {
    if (lookup.type !== NodeTypes.String) {
      throw new Error(`Expected lookups to be String nodes: ${JSON.stringify(lookup)}`);
    }
    return lookup.value;
  });

  if (lookup.name === null) {
    return nestedLookups;
  }

  return [lookup.name, ...nestedLookups];
}

export async function getGlobalSettings(context: Context<SourceCodeType>) {
  const globalSettings: Array<{ id: string; type: string }> = [];

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
            ...group.settings
              .filter((setting: any) => setting.id && setting.type)
              .map((setting: any) => ({ id: setting.id, type: setting.type })),
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

export function buildLiquidLookupReport(
  context: Context<SourceCodeType>,
  offset: number,
  visibleIfNode: JSONNode,
) {
  // the JSONNode start location returned by `getLocStart`
  // includes the opening quotation mark — whereas when we parse
  // the inner expression, 0 is the location _inside_ the quotes.
  // we add 1 to the offsets to compensate.
  const generalOffset = offset + getLocStart(visibleIfNode) + offsetAdjust + 1;

  return (message: string | null, lookup: LiquidVariableLookup) => {
    if (typeof message === 'string') {
      const startIndex = lookup.position.start + generalOffset;
      const endIndex = lookup.position.end + generalOffset;

      context.report({ message, startIndex, endIndex });
    }
  };
}
