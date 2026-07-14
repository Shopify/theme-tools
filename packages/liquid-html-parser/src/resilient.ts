/**
 * Opt-in resilient entry points for the Liquid+HTML parser.
 *
 * These mirror `toLiquidAST` / `toLiquidHtmlAST` from `./ast` exactly, except
 * they construct a `ResilientDocumentParser` instead of the base
 * `DocumentParser`. A structural parse failure that would abort the default
 * parse is instead caught and surfaced as a `LiquidErrorNode`, so the returned
 * `DocumentNode` can carry several errors interleaved with the constructs the
 * parser did recover. The default path is a different class reached by a
 * different function and stays byte-identical.
 */

import type { ASTBuildOptions, DocumentNode, LiquidErrorNode, LiquidHtmlNode } from './ast';
import { walk } from './ast';
import { ResilientDocumentParser } from './document/resilient-parser';
import { tokenize } from './document/tokenizer';
import { Environment } from './environment';
import { NodeTypes } from './types';

/*
 * Resilient variant of `toLiquidAST` (Liquid-only, `parseHtml: false`).
 * Defaults `allowUnclosedDocumentNode: true` so an unterminated document is
 * recovered rather than thrown on — the resilient contract.
 */
export function toResilientLiquidAST(
  source: string,
  options: ASTBuildOptions = {
    allowUnclosedDocumentNode: true,
    mode: 'tolerant',
  },
): DocumentNode {
  const env = options.environment ?? Environment.default();
  const tokens = tokenize(source);
  const parser = new ResilientDocumentParser(
    tokens,
    source,
    env,
    false,
    options.allowUnclosedDocumentNode,
  );
  return parser.parseDocument();
}

/*
 * Resilient variant of `toLiquidHtmlAST` (Liquid+HTML, `parseHtml: true`).
 * Defaults `allowUnclosedDocumentNode: true` so an unterminated document is
 * recovered rather than thrown on — the resilient contract.
 */
export function toResilientLiquidHtmlAST(
  source: string,
  options: ASTBuildOptions = {
    allowUnclosedDocumentNode: true,
    mode: 'tolerant',
  },
): DocumentNode {
  const env = options.environment ?? Environment.default();
  const tokens = tokenize(source);
  const parser = new ResilientDocumentParser(
    tokens,
    source,
    env,
    true,
    options.allowUnclosedDocumentNode,
  );
  return parser.parseDocument();
}

/*
 * Locate the error node the caret is sitting in.
 *
 * A resilient parse can leave several `LiquidErrorNode`s scattered through
 * the tree, one per region the parser gave up on. Completion needs the one
 * the caret is actually inside, so we return the *deepest* error node whose
 * span contains `offset` — the most specific recovery point — paired with
 * its ancestry.
 *
 * The result shape (`{ node, ancestors }`) mirrors `findCurrentNode` in the
 * language server so a later phase can swap the completion context source
 * with minimal churn. `null` means the caret is not inside any error region
 * and the existing (non-error) path should handle it.
 */
export function findErrorNodeAtOffset(
  ast: LiquidHtmlNode,
  offset: number,
): { node: LiquidErrorNode; ancestors: LiquidHtmlNode[] } | null {
  /*
   * `walk` only hands each visited node its immediate parent, and it visits
   * in post-order (parents after children), so the map is only complete once
   * the traversal ends. We therefore record every parent link first, gather
   * the error nodes that contain the offset, and resolve depth/ancestry from
   * the finished map afterwards.
   */
  const parentOf = new Map<LiquidHtmlNode, LiquidHtmlNode | undefined>();
  const candidates: LiquidErrorNode[] = [];

  walk(ast, (node, parent) => {
    parentOf.set(node, parent);
    if (
      node.type === NodeTypes.LiquidErrorNode &&
      offset >= node.position.start &&
      offset <= node.position.end
    ) {
      candidates.push(node);
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  /* Ancestry, root→parent, by climbing the parent map from the node up. */
  const ancestorsOf = (node: LiquidHtmlNode): LiquidHtmlNode[] => {
    const chain: LiquidHtmlNode[] = [];
    let cursor = parentOf.get(node);
    while (cursor !== undefined) {
      chain.push(cursor);
      cursor = parentOf.get(cursor);
    }
    return chain.reverse();
  };

  /*
   * Deepest wins: when error spans nest, the innermost node has the longest
   * ancestor chain. First candidate wins ties, which is stable given walk's
   * deterministic traversal order.
   */
  let best = candidates[0];
  let bestDepth = ancestorsOf(best).length;
  for (let i = 1; i < candidates.length; i++) {
    const depth = ancestorsOf(candidates[i]).length;
    if (depth > bestDepth) {
      best = candidates[i];
      bestDepth = depth;
    }
  }

  return { node: best, ancestors: ancestorsOf(best) };
}
