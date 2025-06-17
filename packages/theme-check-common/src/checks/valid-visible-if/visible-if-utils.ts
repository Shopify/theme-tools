import { type LiquidVariableLookup, NodeTypes, toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { Context, SourceCodeType } from '../..';
import { parseJSON } from '../../json';
import { visit } from '../../visitor';

export type Vars = { [key: string]: Vars | true };

export const variableExpressionMatcher = /{{(.+?)}}/;
export const adjustedPrefix = '{% if ';
export const adjustedSuffix = ' %}{% endif %}';
export const offsetAdjust = '{{'.length - adjustedPrefix.length;

export function getVariableLookupsInExpression(
  expression: string,
): LiquidVariableLookup[] | { warning: string } | null {
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
      warning: `Invalid visible_if expression. It should take the form "{{ <expression> }}".`,
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

    const expressionNode = ifTag.markup;
    if (typeof expressionNode === 'string') {
      return {
        warning: `Invalid visible_if expression.`,
      };
    }

    if (
      expressionNode.type === NodeTypes.LiquidLiteral &&
      ['true', 'false'].includes(expressionNode.keyword)
    ) {
      // Those are OK
      return null;
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
    if (error instanceof SyntaxError) {
      // Because of our hackish approach, the underlying error is likely to
      // include an incorrect character range and/or mention {% if %} tags.
      // Squelch the details and just report it as a simple syntax error.
      return { warning: 'Syntax error: cannot parse visible_if expression.' };
    }

    return { warning: String(error) };
  }
}

export function validateLookup(lookup: LiquidVariableLookup, vars: Vars): string | null {
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
  const nestedLookups = lookup.lookups.map((lookup) => {
    if (lookup.type !== NodeTypes.String) {
      throw new Error(`Expected lookups to be String nodes: ${JSON.stringify(lookup)}`);
    }
    return lookup.value;
  });

  return [lookup.name, ...nestedLookups];
}

export async function getGlobalSettings(context: Context<SourceCodeType>) {
  const globalSettings: string[] = [];

  try {
    const uri = context.toUri('config/settings_schema.json');
    const settingsFile = await context.fs.readFile(uri);
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
