import {
  LiquidHtmlNode,
  LiquidTag,
  LiquidTagAssign,
  LiquidTagCapture,
  LiquidTagFor,
  LiquidTagTablerow,
  LiquidVariableLookup,
  NamedTags,
  NodeTypes,
  Position,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
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
    if (context.relativePath(context.file.absolutePath).startsWith('snippets/')) {
      return {};
    }

    const variableScopes: Map<string, Scope[]> = new Map();
    const variables: LiquidVariableLookup[] = [];

    function indexVariableScope(variableName: string | null, scope: Scope) {
      if (!variableName) return;

      const indexedScope = variableScopes.get(variableName) ?? [];
      const currentScope = [...indexedScope, scope];

      variableScopes.set(variableName, currentScope);
    }

    return {
      async LiquidTag(node) {
        if (isLiquidTagAssign(node)) {
          indexVariableScope(node.markup.name, {
            start: node.blockStartPosition.end,
            end: node.blockEndPosition?.start,
          });
        }

        if (isLiquidTagCapture(node)) {
          indexVariableScope(node.markup.name, {
            start: node.blockEndPosition?.end,
          });
        }

        if (isLiquidForTag(node) || isLiquidTableRowTag(node)) {
          indexVariableScope(node.markup.variableName, {
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
        if (context.themeDocset) {
          const objects = await context.themeDocset.objects();
          objects.forEach((obj) => variableScopes.set(obj.name, []));
        }

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
   * If there are no scopes, the variable is globally defined.
   */
  if (scopes.length === 0) return true;

  /**
   * Checks if a variable is defined within any of the given scopes.
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
