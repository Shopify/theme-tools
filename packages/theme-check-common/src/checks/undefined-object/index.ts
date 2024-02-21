import {
  LiquidHtmlNode,
  LiquidTag,
  LiquidTagAssign,
  LiquidTagCapture,
  LiquidTagDecrement,
  LiquidTagFor,
  LiquidTagIncrement,
  LiquidTagTablerow,
  LiquidVariableLookup,
  NamedTags,
  NodeTypes,
  Position,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType, ThemeDocset } from '../../types';
import { last } from '../../utils';

type Scope = { start?: number; end?: number };

export const UndefinedObject: LiquidCheckDefinition = {
  meta: {
    code: 'UndefinedObject',
    name: 'Undefined Object',
    docs: {
      description: 'This check exists to identify references to undefined Liquid objects.',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/undefined-object',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    /**
     * At present, snippet assets are not supported due to the inability of this
     * check to handle objects defined in other assets.
     */
    const relativePath = context.relativePath(context.file.absolutePath);
    if (relativePath.startsWith('snippets/')) {
      return {};
    }

    /**
     * Skip this check when definitions for global objects are unavailable.
     */
    if (!context.themeDocset) {
      return {};
    }

    const themeDocset = context.themeDocset;
    const variableScopes: Map<string, Scope[]> = new Map();
    const variables: LiquidVariableLookup[] = [];

    function indexVariableScope(variableName: string | null, scope: Scope) {
      if (!variableName) return;

      const indexedScope = variableScopes.get(variableName) ?? [];
      variableScopes.set(variableName, indexedScope.concat(scope));
    }

    return {
      async LiquidTag(node) {
        if (isLiquidTagAssign(node)) {
          indexVariableScope(node.markup.name, {
            start: node.blockStartPosition.end,
          });
        }

        if (isLiquidTagCapture(node)) {
          indexVariableScope(node.markup.name, {
            start: node.blockEndPosition?.end,
          });
        }

        /**
         * {% form 'cart', cart %}
         *   {{ form }}
         * {% endform %}
         */
        if (['form', 'paginate'].includes(node.name)) {
          indexVariableScope(node.name, {
            start: node.blockStartPosition.end,
            end: node.blockEndPosition?.start,
          });
        }

        /* {% layout none %} */
        if (node.name === 'layout') {
          indexVariableScope('none', {
            start: node.position.start,
            end: node.position.end,
          });
        }

        /* {% increment var %} */
        if (
          (isLiquidTagIncrement(node) || isLiquidTagDecrement(node)) &&
          node.markup.name !== null
        ) {
          indexVariableScope(node.markup.name, {
            start: node.position.start,
          });
        }

        /**
         * {% for x in y %}
         *   {{ forloop }}
         *   {{ x }}
         * {% endfor %}
         */
        if (isLiquidForTag(node) || isLiquidTableRowTag(node)) {
          indexVariableScope(node.markup.variableName, {
            start: node.blockStartPosition.end,
            end: node.blockEndPosition?.start,
          });
          indexVariableScope(node.name === 'for' ? 'forloop' : 'tablerowloop', {
            start: node.blockStartPosition.end,
            end: node.blockEndPosition?.start,
          });
        }
      },

      async VariableLookup(node, ancestors) {
        const parent = last(ancestors);

        if (isLiquidTag(parent) && isLiquidTagCapture(parent)) return;

        variables.push(node);
      },

      async onCodePathEnd() {
        const objects = await globalObjects(themeDocset, relativePath);

        objects.forEach((obj) => variableScopes.set(obj.name, []));

        variables.forEach((variable) => {
          if (!variable.name) return;

          const isVariableDefined = isDefined(variable.name, variable.position, variableScopes);
          if (isVariableDefined) return;

          context.report({
            message: `Unknown object '${variable.name}' used.`,
            startIndex: variable.position.start,
            endIndex: variable.position.end,
          });
        });
      },
    };
  },
};

async function globalObjects(themeDocset: ThemeDocset, relativePath: string) {
  const objects = await themeDocset.objects();
  const contextualObjects = getContextualObjects(relativePath);

  const globalObjects = objects.filter(({ access, name }) => {
    return (
      contextualObjects.includes(name) ||
      !access ||
      access.global === true ||
      access.template.length > 0
    );
  });

  return globalObjects;
}

function getContextualObjects(relativePath: string): string[] {
  if (relativePath.startsWith('layout/checkout.liquid')) {
    return [
      'locale',
      'direction',
      'skip_to_content_link',
      'checkout_html_classes',
      'checkout_stylesheets',
      'checkout_scripts',
      'content_for_logo',
      'breadcrumb',
      'order_summary_toggle',
      'content_for_order_summary',
      'alternative_payment_methods',
      'content_for_footer',
      'tracking_code',
    ];
  }
  if (relativePath.startsWith('sections/')) {
    return ['section', 'predictive_search', 'recommendations'];
  }

  if (relativePath.startsWith('blocks/')) {
    return ['app', 'section', 'block'];
  }

  if (relativePath.startsWith('snippets/')) {
    return ['app'];
  }

  return [];
}

function isDefined(
  variableName: string,
  variablePosition: Position,
  scopedVariables: Map<string, Scope[]>,
): boolean {
  const scopes = scopedVariables.get(variableName);
  /**
   * If there's no scope, the variable is not defined.
   */
  if (!scopes) return false;

  /**
   * If there are zero scopes, the variable is globally defined.
   */
  if (scopes.length === 0) return true;

  /**
   * Checks if a variable is defined within any of the scopes.
   */
  return scopes.some((scope) => isDefinedInScope(variablePosition, scope));
}

function isDefinedInScope(variablePosition: Position, scope: Scope) {
  const start = variablePosition.start;
  const isVariableAfterScopeStart = !scope.start || start > scope.start;
  const isVariableBeforeScopeEnd = !scope.end || start < scope.end;

  return isVariableAfterScopeStart && isVariableBeforeScopeEnd;
}

function isLiquidTag(node?: LiquidHtmlNode): node is LiquidTag {
  return node?.type === NodeTypes.LiquidTag;
}

function isLiquidTagCapture(node: LiquidTag): node is LiquidTagCapture {
  return node.name === NamedTags.capture;
}

function isLiquidTagAssign(node: LiquidTag): node is LiquidTagAssign {
  return node.name === NamedTags.assign && typeof node.markup !== 'string';
}

function isLiquidForTag(node: LiquidTag): node is LiquidTagFor {
  return node.name === NamedTags.for && typeof node.markup !== 'string';
}

function isLiquidTableRowTag(node: LiquidTag): node is LiquidTagTablerow {
  return node.name === NamedTags.tablerow && typeof node.markup !== 'string';
}

function isLiquidTagIncrement(node: LiquidTag): node is LiquidTagIncrement {
  return node.name === NamedTags.increment && typeof node.markup !== 'string';
}

function isLiquidTagDecrement(node: LiquidTag): node is LiquidTagDecrement {
  return node.name === NamedTags.decrement && typeof node.markup !== 'string';
}
