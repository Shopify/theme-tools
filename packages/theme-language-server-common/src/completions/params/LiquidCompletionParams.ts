import {
  LiquidHtmlNode,
  LiquidTag,
  NodeTypes,
  Position,
  toLiquidHtmlAST,
} from '@shopify/liquid-html-parser';
import { CompletionParams } from 'vscode-languageserver';
import { AugmentedSourceCode } from '../../documents';
import { fix } from './fix';

interface CompletionContext {
  /** The AST of the Liquid template up to the cursor position */
  readonly partialAst: LiquidHtmlNode;

  /** The node at the cursor position, undefined if cursor is not in a node */
  readonly node: LiquidHtmlNode | undefined;

  /** The ancestry that leads to the current node */
  readonly ancestors: LiquidHtmlNode[];
}

export interface LiquidCompletionParams extends CompletionParams {
  /**
   * The completion context represents additional information that would
   * allow you to offer completions at the cursor position.
   *
   * If undefined, then the file is unparseable.
   */
  readonly completionContext: CompletionContext | undefined;
}

export function createLiquidCompletionParams(
  sourceCode: AugmentedSourceCode,
  params: CompletionParams,
): LiquidCompletionParams {
  const { textDocument } = sourceCode;
  const cursor = textDocument.offsetAt(params.position);
  const completionContext = getCompletionContext(sourceCode, cursor);

  return {
    ...params,
    completionContext,
  };
}

function getCompletionContext(
  sourceCode: AugmentedSourceCode,
  cursor: number,
): CompletionContext | undefined {
  const partialAst = parsePartial(sourceCode, cursor);
  if (!partialAst) {
    return undefined;
  }

  const [node, ancestors] = findCurrentNode(partialAst, cursor);
  return {
    partialAst,
    ancestors,
    node,
  };
}

/**
 * This function will return an AST of the entire file up until the cursor
 * position.
 *
 * So if you accept that we use █ to represent the cursor, and a have a file that
 * looks like this:
 *
 * <div>
 *   {% assign x = product %}
 *   {% assign y = x | plus: 20 %}
 *   {% assign z = █ %}
 *   <span>
 *     this content is not part of the partial tree
 *   </span>
 * </div>
 *
 * Then the contents of the file up until the cursor position is this:
 *
 * <div>
 *   {% assign x = product %}
 *   {% assign y = x | plus: 20 %}
 *   {% assign z = █
 *
 * Then we'll use `fix(sourceCode, cursorPosition)` to make it parseable.
 * Fixed output:
 *
 * <div>
 *   {% assign x = product %}
 *   {% assign y = x | plus: 20 %}
 *   {% assign z = █%}
 *
 * Then we'll parse this with `allowUnclosedDocumentNode` and
 * `mode: completion` to allow parsing of placeholder characters (█)
 *
 * The result is a partial AST whose last-most node is probably the one
 * under the cursor.
 */
function parsePartial(
  sourceCode: AugmentedSourceCode,
  cursorPosition: number,
): LiquidHtmlNode | undefined {
  let fixedSource: string | undefined;
  try {
    fixedSource = fix(sourceCode.source, cursorPosition);
    const ast = toLiquidHtmlAST(fixedSource, {
      allowUnclosedDocumentNode: true,
      mode: 'completion',
    });
    ast._source = sourceCode.source;
    return ast;
  } catch (err: any) {
    // We swallow errors here, because we gracefully accept that and
    // simply don't offer completions when that happens.
    return undefined;
  }
}

class Finder {
  public stack: NonEmptyArray<LiquidHtmlNode | undefined>;

  constructor(ast: LiquidHtmlNode) {
    this.stack = [ast];
  }

  get current(): LiquidHtmlNode | undefined {
    return last(this.stack);
  }

  get parent(): LiquidHtmlNode | undefined {
    return this.stack.at(-2);
  }

  set current(node: LiquidHtmlNode | undefined) {
    this.stack.push(node);
  }
}

/**
 * @returns the node at the cursor position and its ancestry.
 *
 * Undefined when you're not really on a node (there's nothing to complete)
 */
function findCurrentNode(
  partialAst: LiquidHtmlNode,
  cursor: number,
): [node: LiquidHtmlNode | undefined, ancestry: LiquidHtmlNode[]] {
  // The current node is the "last" node in the AST.
  const finder = new Finder(partialAst);
  let current: LiquidHtmlNode = { ...partialAst };

  // Our objective:
  //   Finding the "last-most node" in the partial AST.
  //
  // Context:
  //   A generic visitor doesn't quite work in this context because we
  //   cannot trust the position, blockStartPosition, blockEndPosition of
  //   nodes when we use `allowUnclosedDocumentNode`. You see, these
  //   properties are updated when the nodes are closed. An {% if cond %}
  //   node without its closing {% endif %} would have its position.end be
  //   the one of the starting block. Which means that any children it may
  //   have wouldn't be covered.
  //
  // How we do it:
  //   We define logic per node type. For example, HTML tags will do this:
  //     - If the node is closed (<a>child</a>),
  //         then there's nothing to complete.
  //         We return undefined
  //     - If the node has children,
  //         then we visit the last children
  //     - If the node has attributes,
  //         then we visit the last attribute
  //     - If the node has a name,
  //         then we visit the last name node (<a--{{ product.id }}>)
  //
  //   It's different per node type, because each node type has a different
  //   concept of child node and because they have to be traversed in a
  //   specific order.
  while (finder.current !== undefined && current !== finder.current) {
    current = finder.current;

    switch (current.type) {
      case NodeTypes.Document: {
        if (hasNonEmptyArrayProperty(current, 'children')) {
          finder.current = last(current.children);
        }
        break;
      }

      case NodeTypes.HtmlRawNode:
      case NodeTypes.HtmlVoidElement:
      case NodeTypes.HtmlDanglingMarkerOpen:
      case NodeTypes.HtmlDanglingMarkerClose:
      case NodeTypes.HtmlSelfClosingElement:
      case NodeTypes.HtmlElement: {
        if (isCompletedTag(current)) {
          finder.current = undefined;
        } else if (hasNonEmptyArrayProperty(current, 'children')) {
          finder.current = last(current.children);
        } else if (hasNonEmptyArrayProperty(current, 'attributes')) {
          finder.current = last(current.attributes);
        } else if (
          hasNonEmptyArrayProperty(current, 'name') &&
          isCoveredExcluded(cursor, current.blockStartPosition)
        ) {
          finder.current = last(current.name);
        } else if (
          typeof current.name === 'string' &&
          isCoveredExcluded(cursor, current.blockStartPosition)
        ) {
          /* break */
        } else {
          finder.current = undefined; // there's nothing to complete
        }

        break;
      }

      case NodeTypes.LiquidTag: {
        if (
          isLiquidLiquidTag(finder.parent) ||
          isCoveredExcluded(cursor, current.blockStartPosition)
        ) {
          if (hasNonNullProperty(current, 'markup') && typeof current.markup !== 'string') {
            finder.current = Array.isArray(current.markup) ? current.markup.at(-1) : current.markup;
          } else {
            // Exits the loop and the node is the thing to complete
            // (presumably name or something else)
            // finder.current = finder.current;
          }
        } else if (isIncompleteBlockTag(current)) {
          finder.current = last(current.children);
        } else {
          finder.current = undefined; // we're done and there's nothing to complete
        }
        break;
      }

      case NodeTypes.LiquidBranch:
        if (isCovered(cursor, current.blockStartPosition) && typeof current.markup !== 'string') {
          finder.current = Array.isArray(current.markup) ? current.markup.at(-1) : current.markup;
        } else if (hasNonEmptyArrayProperty(current, 'children')) {
          finder.current = last(current.children);
        } else {
          finder.current = undefined; // there's nothing to complete
        }
        break;

      case NodeTypes.LiquidRawTag:
        break;

      case NodeTypes.AttrDoubleQuoted:
      case NodeTypes.AttrSingleQuoted:
      case NodeTypes.AttrEmpty:
      case NodeTypes.AttrUnquoted: {
        const lastNameNode = last(current.name as NonEmptyArray<(typeof current.name)[number]>); // there's at least one... guaranteed.
        if (isCovered(cursor, lastNameNode.position)) {
          finder.current = lastNameNode;
        } else if (
          current.type !== NodeTypes.AttrEmpty &&
          isCovered(cursor, current.attributePosition) &&
          isNotEmpty(current.value)
        ) {
          finder.current = last(current.value);
        } else {
          finder.current = undefined;
        }
        break;
      }

      case NodeTypes.YAMLFrontmatter:
      case NodeTypes.HtmlDoctype:
      case NodeTypes.HtmlComment:
      case NodeTypes.RawMarkup: {
        break;
      }

      case NodeTypes.LiquidVariableOutput: {
        if (typeof current.markup !== 'string') {
          finder.current = current.markup;
        }
        break;
      }

      case NodeTypes.LiquidVariable: {
        if (isNotEmpty(current.filters)) {
          finder.current = last(current.filters);
        } else {
          finder.current = current.expression;
        }
        break;
      }

      case NodeTypes.LiquidFilter: {
        if (isNotEmpty(current.args)) {
          finder.current = last(current.args);
        }
        break;
      }

      case NodeTypes.VariableLookup: {
        if (
          hasNonEmptyArrayProperty(current, 'lookups') &&
          last(current.lookups).type === NodeTypes.VariableLookup
        ) {
          finder.current = last(current.lookups);
        }
        break;
      }

      case NodeTypes.AssignMarkup: {
        finder.current = current.value;
        break;
      }

      case NodeTypes.ForMarkup: {
        if (isCovered(cursor, current.collection.position)) {
          finder.current = current.collection;
        } else if (isNotEmpty(current.args) && isCovered(cursor, last(current.args).position)) {
          finder.current = last(current.args);
        }
        break;
      }

      case NodeTypes.NamedArgument: {
        if (isCovered(cursor, current.value.position)) {
          finder.current = current.value;
        }
        break;
      }

      case NodeTypes.Comparison: {
        finder.current = current.right;
        break;
      }

      case NodeTypes.LogicalExpression: {
        finder.current = current.right;
        break;
      }

      case NodeTypes.CycleMarkup: {
        if (isNotEmpty(current.args)) {
          finder.current = last(current.args);
        }
        break;
      }

      case NodeTypes.PaginateMarkup: {
        if (isNotEmpty(current.args)) {
          finder.current = last(current.args);
        } else if (isCovered(cursor, current.collection.position)) {
          finder.current = current.collection;
        } else if (isCovered(cursor, current.pageSize.position)) {
          finder.current = current.pageSize;
        }
        break;
      }

      case NodeTypes.RenderMarkup: {
        if (isNotEmpty(current.args)) {
          finder.current = last(current.args);
        } else if (current.variable && isCovered(cursor, current.variable.position)) {
          finder.current = current.variable;
        }

        break;
      }

      case NodeTypes.RenderVariableExpression: {
        finder.current = current.name;
        break;
      }

      case NodeTypes.Range: {
        // This means you can't complete the start range as a variable...
        // is this bad?
        finder.current = current.end;
        break;
      }

      // If you end up on any of these. You're done.
      // That's the current node.
      case NodeTypes.TextNode:
      case NodeTypes.LiquidLiteral:
      case NodeTypes.String:
      case NodeTypes.Number: {
        break;
      }

      default: {
        return assertNever(current);
      }
    }
  }

  return [finder.stack.pop()!, finder.stack as NonEmptyArray<LiquidHtmlNode>];
}

type NonEmptyArray<T> = [T, ...T[]];

function hasNonNullProperty<K extends PropertyKey>(
  thing: any,
  property: K,
): thing is { [k in K]: NonNullable<any> } {
  return thing !== null && property in thing && !!thing[property];
}

function isIncompleteBlockTag(thing: any): thing is { children: NonEmptyArray<any> } {
  return (
    hasNonEmptyArrayProperty(thing, 'children') &&
    (!hasNonNullProperty(thing, 'blockEndPosition') ||
      (thing.blockEndPosition.start === -1 && thing.blockEndPosition.end === -1))
  );
}

function isCompletedTag(thing: any) {
  return (
    hasNonNullProperty(thing, 'blockEndPosition') &&
    thing.blockEndPosition.start !== -1 &&
    thing.blockEndPosition.end !== -1
  );
}

function hasNonEmptyArrayProperty<K extends PropertyKey>(
  thing: any,
  property: K,
): thing is { [k in K]: NonEmptyArray<any> } {
  return (
    thing !== null &&
    property in thing &&
    Array.isArray(thing[property]) &&
    !isEmpty(thing[property])
  );
}

function isLiquidLiquidTag(
  node: LiquidHtmlNode | undefined,
): node is LiquidTag & { name: 'liquid' } {
  if (!node) return false;
  return node.type === NodeTypes.LiquidTag && node.name === 'liquid';
}

function isCoveredExcluded(cursor: number, position: Position): boolean {
  return position.start <= cursor && cursor < position.end;
}

function isCovered(cursor: number, position: Position): boolean {
  return position.start <= cursor && cursor <= position.end;
}

function isNotEmpty<T = any>(x: T[]): x is NonEmptyArray<T> {
  return x.length > 0;
}

function isEmpty(x: any[]): x is [] {
  return x.length === 0;
}

function last<T = any>(x: NonEmptyArray<T>): T {
  return x[x.length - 1];
}

function assertNever(x: never): never {
  throw new Error(`This function should never be called, but was called with ${x}`);
}
