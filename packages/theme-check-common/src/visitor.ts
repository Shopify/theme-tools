import { NodeTypes as LiquidHtmlNodeTypes } from '@shopify/liquid-html-parser';
import { AST, LiquidHtmlNode, NodeOfType, SourceCodeType, NodeTypes, JSONNode } from './types';

export type VisitorMethod<S extends SourceCodeType, T, R> = (
  node: NodeOfType<S, T>,
  ancestors: AST[S][],
) => R | R[] | undefined;

export type Visitor<S extends SourceCodeType, R> = {
  /** Happens once per node, while going down the tree */
  [T in NodeTypes[S]]?: VisitorMethod<S, T, R>;
};

function isNode<S extends SourceCodeType>(x: any): x is NodeOfType<S, NodeTypes[S]> {
  return x !== null && typeof x === 'object' && typeof x.type === 'string';
}

export type ExecuteFunction<S extends SourceCodeType> = (node: AST[S], lineage: AST[S][]) => void;

/**
 * @example
 *
 * const links = visit<'LiquidHTML', DocumentLink>(liquidAST, {
 *   'LiquidTag': (node, ancestors) => {
 *     if (node.name === 'render' || node.name === 'include') {
 *       return DocumentLink.create(...);
 *     }
 *   },
 * })
 *
 * Note: this is the ChatGPT-rewritten version of the recursive method.
 * If you want to refactor it, just ask it to do it for you :P
 */
export function visit<S extends SourceCodeType, R>(node: AST[S], visitor: Visitor<S, R>): R[] {
  const results: R[] = [];
  const stack: { node: AST[S]; lineage: AST[S][] }[] = [{ node, lineage: [] }];
  const pushStack = (node: AST[S], lineage: AST[S][]) => stack.push({ node, lineage });

  while (stack.length > 0) {
    // Visit current node
    const { node, lineage } = stack.pop() as {
      node: AST[S];
      lineage: AST[S][];
    };

    const visitNode = visitor[node.type as any as NodeTypes[S]];
    const result = visitNode ? visitNode(node as NodeOfType<S, NodeTypes[S]>, lineage) : undefined;
    if (Array.isArray(result)) {
      results.push(...result);
    } else if (result !== undefined) {
      results.push(result);
    }

    // Enqueue child nodes
    forEachChildNodes(node, lineage.concat(node), pushStack);
  }

  return results;
}

export function forEachChildNodes<S extends SourceCodeType>(
  node: AST[S],
  lineage: AST[S][],
  execute: ExecuteFunction<S>,
) {
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) {
        execute(value[i], lineage);
      }
    } else if (isNode<S>(value)) {
      execute(value, lineage);
    }
  }
}

export function findCurrentNode(
  ast: LiquidHtmlNode,
  cursorPosition: number,
): [node: LiquidHtmlNode, ancestors: LiquidHtmlNode[]] {
  let prev: LiquidHtmlNode | undefined;
  let current: LiquidHtmlNode = ast;
  let ancestors: LiquidHtmlNode[] = [];

  while (current !== prev) {
    prev = current;
    forEachChildNodes<SourceCodeType.LiquidHtml>(
      current,
      ancestors.concat(current),
      (child, lineage) => {
        if (
          isUnclosed(child) ||
          (isCovered(child, cursorPosition) && size(child) <= size(current))
        ) {
          current = child;
          ancestors = lineage;
        }
      },
    );
  }

  return [current, ancestors];
}

function isCovered(node: LiquidHtmlNode, offset: number): boolean {
  switch (node.type) {
    // `product.█title` should cover `title`
    case LiquidHtmlNodeTypes.String:
    // `if █cond` should cover `cond`
    case LiquidHtmlNodeTypes.VariableLookup:
    // `if █cond and other` should cover `cond`
    case LiquidHtmlNodeTypes.LogicalExpression:
    // `if █cond < other` should cover `cond`
    case LiquidHtmlNodeTypes.Comparison:
      return node.position.start <= offset && offset <= node.position.end;

    // default case avoids ambiguity by having the cursor in the [excluded, included] range
    default:
      return node.position.start < offset && offset <= node.position.end;
  }
}

function size(node: LiquidHtmlNode): number {
  return node.position.end - node.position.start;
}

function isUnclosed(node: LiquidHtmlNode): boolean {
  if ('blockEndPosition' in node) {
    return node.blockEndPosition?.end === -1;
  } else if ('children' in node) {
    return node.children!.length > 0;
  }
  return false;
}

export function findJSONNode(
  ast: JSONNode,
  cursorPosition: number,
): [node: JSONNode, ancestors: JSONNode[]] {
  let prev: JSONNode | undefined;
  let current: JSONNode = ast;
  let ancestors: JSONNode[] = [];
  const offset = cursorPosition;

  while (current !== prev) {
    prev = current;
    forEachChildNodes<SourceCodeType.JSON>(current, ancestors.concat(current), (child, lineage) => {
      if (child.loc.start.offset <= offset && offset < child.loc.end.offset) {
        current = child;
        ancestors = lineage;
      }
    });
  }

  return [current, ancestors];
}
