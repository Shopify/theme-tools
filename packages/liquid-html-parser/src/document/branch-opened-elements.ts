import { NodeTypes } from '../types';
import type { CompoundNameSegment, LiquidHtmlNode } from '../ast';

/**
 * Whether a `</name>` close tag, met after the nodes already parsed into
 * `scope`, ends an element a conditional in that scope left open, rather than
 * the enclosing element.
 *
 * A conditional may leave an element open when its branch ends (the parser marks
 * it with a zero-width `blockEndPosition`):
 *
 *   {% if a %}<div class="x">{% else %}<div class="y">{% endif %}
 *     {{ content_for_layout }}
 *   </div>
 *
 * Liquid writes whichever branch ran, so the `</div>` closes that `<div>`. Such
 * a close is parsed as an `HtmlDanglingMarkerClose`, which a renderer can pair
 * with the open element.
 *
 * The scope's nodes are read in output order into a stack of the elements left
 * open on every path, innermost last. A close converts only when it names the
 * innermost element on that stack, so a crossed close
 * (`<section><div>` … `</section>`) never converts. A dangling close pops the
 * stack only when it names the innermost element; otherwise it closes nothing,
 * so it leaves no debt against elements opened later.
 *
 * Each path through an `if` / `unless` / `case` starts from the current stack,
 * and an `if` / `unless` / `case` without an `else` adds the empty path. The
 * stack after the tag is the longest prefix every path agrees on:
 * `{% if c %}<a>{% endif %}` leaves an `<a>` open only when `c` holds, so it adds
 * nothing, and a later `</a>` keeps the parser's existing answer. Other block tags
 * are read the same way with their body as one path beside the empty one.
 *
 * The stack is kept per scope array and extended as nodes are appended, so each
 * node is read once however many close tags the scope meets.
 */
export function closesInnermostBranchOpenedElement(scope: LiquidHtmlNode[], name: string): boolean {
  let state = scopeStates.get(scope);
  if (state === undefined) {
    state = { read: 0, stack: EMPTY };
    scopeStates.set(scope, state);
  }
  while (state.read < scope.length) {
    state.stack = applyNode(state.stack, scope[state.read]);
    state.read += 1;
  }
  return state.stack.length > 0 && state.stack[state.stack.length - 1] === name.toLowerCase();
}

type OpenStack = readonly string[];

const EMPTY: OpenStack = [];

/**
 * The open stack after the nodes read so far, per scope. The parser only appends
 * to a scope's children while it parses that scope, so reading from `read` on is
 * enough to stay current.
 */
const scopeStates = new WeakMap<LiquidHtmlNode[], { read: number; stack: OpenStack }>();

const CONDITIONAL_TAGS = new Set(['if', 'unless', 'case']);

/**
 * Stands in for a branch-opened element with a Liquid (compound) name. No close
 * tag can name it, so it only blocks closes from reaching elements beneath it.
 */
const UNNAMED = '';

function applyNodes(stack: OpenStack, nodes: LiquidHtmlNode[]): OpenStack {
  let current = stack;
  for (const node of nodes) current = applyNode(current, node);
  return current;
}

function applyNode(stack: OpenStack, node: LiquidHtmlNode): OpenStack {
  switch (node.type) {
    case NodeTypes.HtmlElement: {
      const end = node.blockEndPosition;
      if (end.start !== end.end) return stack;
      return applyNodes([...stack, plainName(node.name) ?? UNNAMED], node.children);
    }
    case NodeTypes.HtmlDanglingMarkerClose: {
      const name = plainName(node.name);
      const top = stack[stack.length - 1];
      return name !== null && top === name ? stack.slice(0, -1) : stack;
    }
    case NodeTypes.LiquidTag:
      return applyBlock(stack, node);
    default:
      return stack;
  }
}

function applyBlock(
  stack: OpenStack,
  node: Extract<LiquidHtmlNode, { type: NodeTypes.LiquidTag }>,
): OpenStack {
  if (!Array.isArray(node.children) || node.children.length === 0) return stack;

  const paths: OpenStack[] = [];
  const branched = node.children.every((child) => child.type === NodeTypes.LiquidBranch);
  if (CONDITIONAL_TAGS.has(node.name) && branched) {
    let hasElse = false;
    for (const branch of node.children) {
      if (branch.type !== NodeTypes.LiquidBranch) continue;
      // Liquid never writes what sits between `{% case %}` and its first `{% when %}`.
      if (node.name === 'case' && branch.name === null) continue;
      if (branch.name === 'else') hasElse = true;
      paths.push(applyNodes(stack, branch.children));
    }
    if (!hasElse) paths.push(stack);
  } else {
    const body = branched
      ? node.children.flatMap((child) =>
          child.type === NodeTypes.LiquidBranch ? child.children : [],
        )
      : node.children;
    paths.push(applyNodes(stack, body), stack);
  }
  return commonPrefix(paths);
}

function commonPrefix(paths: OpenStack[]): OpenStack {
  const [first, ...rest] = paths;
  if (first === undefined) return EMPTY;
  let length = first.length;
  for (const path of rest) {
    length = Math.min(length, path.length);
    for (let i = 0; i < length; i++) {
      if (path[i] !== first[i]) {
        length = i;
        break;
      }
    }
  }
  return length === first.length ? first : first.slice(0, length);
}

function plainName(segments: CompoundNameSegment[]): string | null {
  if (segments.length !== 1) return null;
  const segment = segments[0];
  return segment.type === NodeTypes.TextNode ? segment.value.toLowerCase() : null;
}
