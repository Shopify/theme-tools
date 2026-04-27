import {
  HtmlComment,
  LiquidDocParamNode,
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
  toLiquidAST,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Mode, Severity, SourceCodeType, ThemeDocset } from '../../types';
import { isError, last } from '../../utils';
import { hasLiquidDoc } from '../../liquid-doc/liquidDoc';
import { isWithinRawTagThatDoesNotParseItsContents } from '../utils';

type Scope = { start?: number; end?: number };

export const UndefinedObject: LiquidCheckDefinition = {
  meta: {
    code: 'UndefinedObject',
    name: 'Undefined Object',
    docs: {
      description: 'This check exists to identify references to undefined Liquid objects.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/undefined-object',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    const ast = context.file.ast;

    if (isError(ast)) return {};

    /**
     * Skip this check when a snippet does not have the presence of doc tags.
     */
    if (relativePath.startsWith('snippets/') && !hasLiquidDoc(ast)) return {};

    /**
     * Skip this check when definitions for global objects are unavailable.
     */
    if (!context.themeDocset) {
      return {};
    }

    const themeDocset = context.themeDocset;
    const scopedVariables: Map<string, Scope[]> = new Map();
    const fileScopedVariables: Set<string> = new Set();
    const variables: LiquidVariableLookup[] = [];

    function indexVariableScope(variableName: string | null, scope: Scope) {
      if (!variableName) return;

      const indexedScope = scopedVariables.get(variableName) ?? [];
      scopedVariables.set(variableName, indexedScope.concat(scope));
    }

    return {
      async LiquidDocParamNode(node: LiquidDocParamNode) {
        const paramName = node.paramName?.value;
        if (paramName) {
          fileScopedVariables.add(paramName);
        }
      },

      async HtmlComment(node: HtmlComment) {
        // Liquid inside HTML comments is still executed at runtime: the
        // browser strips the `<!-- ... -->` after Liquid has already run.
        // The HTML grammar treats `HtmlComment.body` as opaque text, so the
        // visitor never reaches Liquid nodes nested inside one. We compensate
        // by re-parsing the comment body and pre-registering any file-scoped
        // variable declarations (`assign`, `capture`, `increment`,
        // `decrement`) so references after the comment do not get flagged
        // as undefined.
        //
        // We only register variables whose effect is visible *outside* the
        // comment. Block-local definitions (`for`, `tablerow`, `form`,
        // `paginate`, `layout none`) cannot leak past the closing `-->` and
        // any references to them inside the comment are themselves
        // unreachable to the visitor, so there is nothing to track.
        if (typeof node.body !== 'string' || node.body.length === 0) return;

        let commentAst;
        try {
          commentAst = toLiquidAST(node.body);
        } catch {
          // The body is malformed Liquid (or just plain text). Treat the
          // comment as opaque rather than failing the entire check run.
          return;
        }

        const scopeStart = node.position.end;
        for (const child of collectFileScopeDefiningTags(commentAst.children)) {
          indexVariableScope(child.name, { start: scopeStart });
        }
      },

      async LiquidTag(node, ancestors) {
        if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

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
        if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

        const parent = last(ancestors);
        if (isLiquidTag(parent) && isLiquidTagCapture(parent)) return;

        variables.push(node);
      },

      async onCodePathEnd() {
        const objects = await globalObjects(themeDocset, relativePath, context.mode);

        objects.forEach((obj) => fileScopedVariables.add(obj.name));

        variables.forEach((variable) => {
          if (!variable.name) return;

          const isVariableDefined = isDefined(
            variable.name,
            variable.position,
            fileScopedVariables,
            scopedVariables,
          );
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

async function globalObjects(themeDocset: ThemeDocset, relativePath: string, mode: Mode = 'theme') {
  const objects = await themeDocset.objects();
  const contextualObjects = getContextualObjects(relativePath, mode);

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

const BLOCK_CONTEXTUAL_OBJECTS = ['app', 'section', 'recommendations', 'block'];

function getContextualObjects(relativePath: string, mode: Mode = 'theme'): string[] {
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
    return ['section', 'predictive_search', 'recommendations', 'comment'];
  }

  if (relativePath.startsWith('blocks/')) {
    return BLOCK_CONTEXTUAL_OBJECTS;
  }

  if (relativePath.startsWith('snippets/')) {
    // In a theme app extension, snippets can only be rendered from blocks,
    // so they have access to the same contextual objects as blocks.
    if (mode === 'app') return BLOCK_CONTEXTUAL_OBJECTS;
    return ['app'];
  }

  return [];
}

function isDefined(
  variableName: string,
  variablePosition: Position,
  fileScopedVariables: Set<string>,
  scopedVariables: Map<string, Scope[]>,
): boolean {
  /**
   * Check if the variable is defined in the file
   */
  if (fileScopedVariables.has(variableName)) {
    return true;
  }

  /**
   * Check if the variable is defined within a specific scope
   */
  const scopes = scopedVariables.get(variableName);

  /**
   * If no specific scopes exist (and it wasn't defined in the file), it's undefined
   */
  if (!scopes) {
    return false;
  }

  /**
   * Check if the variable's usage position falls within any of the defined scopes
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

/**
 * Walk a Liquid sub-AST (for example, the parsed body of an HTML comment)
 * and yield the names of every `assign`, `capture`, `increment`, and
 * `decrement` tag found. These are the four tag types whose variable
 * declarations remain in scope after their enclosing block ends.
 *
 * Block-local declarations from `for`, `tablerow`, `form`, `paginate`, and
 * `layout` are intentionally skipped: their scope cannot escape the block,
 * so they cannot contribute to a reference outside the original HTML
 * comment.
 */
function* collectFileScopeDefiningTags(
  nodes: LiquidHtmlNode[],
): Generator<{ name: string }> {
  for (const node of nodes) {
    if (node.type === NodeTypes.LiquidTag) {
      const tag = node as LiquidTag;

      if (isLiquidTagAssign(tag) && tag.markup.name) {
        yield { name: tag.markup.name };
      } else if (isLiquidTagCapture(tag) && tag.markup.name) {
        yield { name: tag.markup.name };
      } else if (
        (isLiquidTagIncrement(tag) || isLiquidTagDecrement(tag)) &&
        tag.markup.name !== null
      ) {
        yield { name: tag.markup.name };
      }

      // `capture`, `if`, `unless`, `case`, `for`, `tablerow`, `form`,
      // `paginate` etc. can contain nested children that themselves declare
      // file-scope variables (e.g. an `assign` inside a `capture` body
      // pattern, or `assign` branches inside an `if`).
      if (Array.isArray(tag.children)) {
        yield* collectFileScopeDefiningTags(tag.children);
      }
    } else if ('children' in node && Array.isArray((node as any).children)) {
      yield* collectFileScopeDefiningTags((node as any).children);
    }
  }
}
