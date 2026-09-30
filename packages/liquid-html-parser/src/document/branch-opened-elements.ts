import { NodeTypes } from '../types';
import type { CompoundNameSegment, LiquidHtmlNode } from '../ast';

/**
 * How many `<name>` elements the nodes of one scope leave open on every output
 * path — the count a later `</name>` in the same scope can close.
 *
 * A conditional may leave an element open when its branch ends (the parser marks
 * it with a zero-width `blockEndPosition`):
 *
 *   {% if a %}<div class="x">{% else %}<div class="y">{% endif %}
 *     {{ content_for_layout }}
 *   </div>
 *
 * Liquid writes whichever branch ran, so the `</div>` closes that `<div>`. Every
 * branch leaves one open, so the balance is 1. A close counted here is parsed as
 * an `HtmlDanglingMarkerClose`, which a renderer can pair with the open.
 *
 * A conditional counts only when all its paths agree, including the empty path
 * of an `if` / `unless` / `case` without an `else`. `{% if c %}<a>{% endif %}`
 * leaves an `<a>` open only when `c` holds, so it counts as 0: a later `</a>`
 * is not known to close it, and the parser keeps its existing answer for it.
 * Other block tags count as 0. Only elements opened in a branch count, never an
 * element the scope closed itself.
 */
export function branchOpenedElementBalance(nodes: LiquidHtmlNode[], name: string): number {
  let balance = 0;
  for (const node of nodes) balance += nodeBalance(node, name);
  return balance;
}

const CONDITIONAL_TAGS = new Set(['if', 'unless', 'case']);

function nodeBalance(node: LiquidHtmlNode, name: string): number {
  switch (node.type) {
    case NodeTypes.HtmlElement: {
      const end = node.blockEndPosition;
      if (end.start !== end.end) return 0;
      const own = plainNameMatches(node.name, name) ? 1 : 0;
      return own + branchOpenedElementBalance(node.children, name);
    }
    case NodeTypes.HtmlDanglingMarkerClose:
      return plainNameMatches(node.name, name) ? -1 : 0;
    case NodeTypes.LiquidTag:
      return conditionalBalance(node, name);
    default:
      return 0;
  }
}

function conditionalBalance(
  node: Extract<LiquidHtmlNode, { type: NodeTypes.LiquidTag }>,
  name: string,
): number {
  if (!CONDITIONAL_TAGS.has(node.name) || !Array.isArray(node.children)) return 0;

  const paths: number[] = [];
  let hasElse = false;
  for (const branch of node.children) {
    if (branch.type !== NodeTypes.LiquidBranch) return 0;
    // Liquid never writes what sits between `{% case %}` and its first `{% when %}`.
    if (node.name === 'case' && branch.name === null) continue;
    if (branch.name === 'else') hasElse = true;
    paths.push(branchOpenedElementBalance(branch.children, name));
  }
  if (!hasElse) paths.push(0);

  const first = paths[0] ?? 0;
  return paths.every((path) => path === first) ? first : 0;
}

function plainNameMatches(segments: CompoundNameSegment[], name: string): boolean {
  if (segments.length !== 1) return false;
  const segment = segments[0];
  return segment.type === NodeTypes.TextNode && segment.value.toLowerCase() === name;
}
