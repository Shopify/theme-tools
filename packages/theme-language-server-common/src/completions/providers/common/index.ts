import { NodeTypes } from '@shopify/liquid-html-parser';

export { createCompletionItem } from './CompletionItemProperties';
export { Provider } from './Provider';

export function sortByName(
  { name: nameA }: { name: string },
  { name: nameB }: { name: string },
): number {
  if (nameA < nameB) {
    return -1;
  }

  if (nameA > nameB) {
    return 1;
  }

  // names must be equal
  return 0;
}

/*
 * A node that may carry the text the user is currently completing. Kept
 * structural so both real AST nodes (whose `name`/`value` can be a string,
 * null, or a sub-node array) and synthesized completion nodes satisfy it.
 */
type CompletionPartialNode = {
  type?: string;
  position: { start: number };
  name?: unknown;
  value?: unknown;
};

/*
 * Where the node's name/value token actually begins.
 *
 * `position.start` is the name-token start for token-aligned nodes
 * (VariableLookup, String, TextNode, synth nodes, ...), but for
 * delimiter-anchored nodes it points at the delimiter, not the name:
 *
 *   - LiquidTag / LiquidBranch start at the opening `{%`. We skip the
 *     delimiter, an optional whitespace-stripping `-`, and any whitespace so
 *     the partial begins at the tag name. In a `{% liquid %}` block the
 *     sub-tags have no `{%`, so the regex simply does not match and the start
 *     is left where it already sits — on the name.
 *   - LiquidFilter starts at the `|`. We skip the pipe and its surrounding
 *     whitespace, mirroring the offset FilterCompletionProvider computes at
 *     FilterCompletionProvider.ts:84-88.
 */
function nameTokenStart(node: CompletionPartialNode, source: string): number {
  const start = node.position.start;
  const rest = source.slice(start);

  if (node.type === NodeTypes.LiquidTag || node.type === NodeTypes.LiquidBranch) {
    const match = rest.match(/^\{%-?\s*/);
    return start + (match ? match[0].length : 0);
  }

  if (node.type === NodeTypes.LiquidFilter) {
    const match = rest.match(/^\s*\|\s*/);
    return start + (match ? match[0].length : 0);
  }

  return start;
}

/*
 * Returns what the user has typed at the caret: the identifier or value of
 * `node` sliced from its name-token start up to `cursor`, clamped to the
 * node's own name/value span so the delimiter, trailing whitespace, or later
 * tokens never leak in.
 *
 * Synthesized empty nodes (name/value `''` at a zero-width caret span) and a
 * missing node both yield `''`. This replaces the old
 * `node.name.replace(CURSOR, '')` idiom now that no sentinel is injected.
 */
export function completionPartial(
  node: CompletionPartialNode | undefined,
  cursor: number,
  source: string,
): string {
  if (!node) return '';

  const start = nameTokenStart(node, source);
  const text =
    typeof node.name === 'string' ? node.name : typeof node.value === 'string' ? node.value : '';
  const end = Math.min(cursor, start + text.length);

  if (end <= start) return '';

  return source.slice(start, end);
}
