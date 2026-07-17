import { NodeTypes } from '../types';
import type { LiquidHtmlNode, TextNode, LiquidVariableOutput } from '../ast';
import { makeTextNode } from './factories';
import { assertNever } from '../utils';

export enum ChildFilterMode {
  /** Syntactic auto-skip: merge adjacent TextNodes, trim whitespace at boundaries, drop empty. */
  Syntactic,
  /** Merge adjacent TextNodes, preserve all whitespace content. */
  Preserve,
  /** Merge, then strip whitespace-only TextNodes from first/last positions only. */
  StripEdges,
}

export function filterChildren(
  mode: ChildFilterMode,
  children: LiquidHtmlNode[],
  source: string,
): LiquidHtmlNode[] {
  switch (mode) {
    case ChildFilterMode.Syntactic:
      return mergeAdjacentTextNodesTrimmed(children, source);
    case ChildFilterMode.Preserve:
      return mergeAdjacentTextNodes(children, source);
    case ChildFilterMode.StripEdges:
      return mergeAdjacentTextNodesStripEdges(children, source);
    default:
      assertNever(mode);
  }
}

function isTextNode(node: LiquidHtmlNode): node is TextNode {
  return node.type === NodeTypes.TextNode;
}

function isLiquidVariableOutput(node: LiquidHtmlNode): node is LiquidVariableOutput {
  return node.type === NodeTypes.LiquidVariableOutput;
}

export function mergeAdjacentTextNodes(nodes: LiquidHtmlNode[], source: string): LiquidHtmlNode[] {
  if (nodes.length <= 1) return nodes;

  const result: LiquidHtmlNode[] = [];
  let runStart = -1;

  for (let i = 0; i <= nodes.length; i++) {
    const node = nodes[i];
    const inRun = runStart !== -1;
    const isText = node !== undefined && isTextNode(node);

    if (isText && !inRun) {
      runStart = i;
      continue;
    }

    if (!isText && inRun) {
      const runEnd = i - 1;
      if (runStart === runEnd) {
        result.push(nodes[runStart]);
      } else {
        const first = nodes[runStart] as TextNode;
        const last = nodes[runEnd] as TextNode;
        result.push(
          makeTextNode(
            source.slice(first.position.start, last.position.end),
            first.position.start,
            last.position.end,
            source,
          ),
        );
      }
      runStart = -1;
    }

    if (node !== undefined && !isText) {
      result.push(node);
    }
  }

  return result;
}

/**
 * Merge adjacent text nodes then trim whitespace from text node boundaries
 * adjacent to non-text nodes. Used for raw tag bodies and branch children
 * where surrounding whitespace around Liquid tags should be dropped.
 */
export function mergeAdjacentTextNodesTrimmed(
  nodes: LiquidHtmlNode[],
  source: string,
): LiquidHtmlNode[] {
  const merged = mergeAdjacentTextNodes(nodes, source);
  if (merged.length === 0) return merged;

  const result: LiquidHtmlNode[] = [];
  for (let i = 0; i < merged.length; i++) {
    const node = merged[i];
    if (!isTextNode(node)) {
      result.push(node);
      continue;
    }

    let value = node.value;
    let start = node.position.start;
    let end = node.position.end;

    // Trim leading whitespace if preceded by a non-text node or at start
    const prev = merged[i - 1];
    if (!prev || !isTextNode(prev)) {
      const trimmed = value.replace(/^\s+/, '');
      const trimLen = value.length - trimmed.length;
      value = trimmed;
      start += trimLen;
    }

    // Trim trailing whitespace if followed by a non-text node or at end
    const next = merged[i + 1];
    if (!next || !isTextNode(next)) {
      const trimmed = value.replace(/\s+$/, '');
      const trimLen = value.length - trimmed.length;
      value = trimmed;
      end -= trimLen;
    }

    if (value.length > 0) {
      result.push(makeTextNode(value, start, end, source));
    }
  }

  return result;
}

/**
 * Merge adjacent text nodes then strip whitespace-only text nodes from the
 * edges. Used at the document root and tag children where meaningful text
 * content (including its whitespace) should be preserved, but whitespace-only
 * edge nodes from template indentation should be dropped.
 */
export function mergeAdjacentTextNodesStripEdges(
  nodes: LiquidHtmlNode[],
  source: string,
): LiquidHtmlNode[] {
  const merged = mergeAdjacentTextNodes(nodes, source);
  let start = 0;
  let end = merged.length;
  while (start < end && isWhitespaceOnlyTextNode(merged[start])) start++;
  while (end > start && isWhitespaceOnlyTextNode(merged[end - 1])) end--;
  if (start === 0 && end === merged.length) return merged;
  return merged.slice(start, end);
}

function isWhitespaceOnlyTextNode(node: LiquidHtmlNode): boolean {
  return isTextNode(node) && /^\s+$/.test(node.value);
}

export function compoundNamesMatch(a: LiquidHtmlNode[], b: LiquidHtmlNode[]): boolean {
  // When the entire tag name is a Liquid control-flow block (e.g.
  // `<{% if cond %}sticky-header{% else %}div{% endif %}>`), the resolved
  // element name is determined at render time and cannot be verified
  // statically. The open and close blocks may also differ in their branch
  // bodies (the open tag can glue an attribute into the conditional, e.g.
  // `sticky-header data-sticky-type="..."`, while the close tag only names
  // the element), so source-text comparison rejects a valid pair. Ruby's
  // parser accepts these; trust the pair when both names are wholly a single
  // LiquidTag/LiquidRawTag segment.
  if (isWhollyLiquidTagName(a) && isWhollyLiquidTagName(b)) return true;

  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const nodeA = a[i];
    const nodeB = b[i];

    if (nodeA.type !== nodeB.type) return false;

    if (isTextNode(nodeA) && isTextNode(nodeB)) {
      if (nodeA.value !== nodeB.value) return false;
      continue;
    }

    if (isLiquidVariableOutput(nodeA) && isLiquidVariableOutput(nodeB)) {
      const markupA = typeof nodeA.markup === 'string' ? nodeA.markup : nodeA.markup.rawSource;
      const markupB = typeof nodeB.markup === 'string' ? nodeB.markup : nodeB.markup.rawSource;
      if (markupA !== markupB) return false;
      continue;
    }

    // LiquidTag or LiquidRawTag: compare by source text
    if (nodeA.type === nodeB.type && 'source' in nodeA && 'source' in nodeB) {
      const srcA = nodeA.source.slice(nodeA.position.start, nodeA.position.end);
      const srcB = nodeB.source.slice(nodeB.position.start, nodeB.position.end);
      if (srcA !== srcB) return false;
      continue;
    }

    return false;
  }

  return true;
}

// A tag name that is entirely a Liquid control-flow block (LiquidTag/LiquidRawTag),
// so the rendered element name is decided at runtime and cannot be matched
// statically against its close tag. See `compoundNamesMatch`.
function isWhollyLiquidTagName(segments: LiquidHtmlNode[]): boolean {
  return (
    segments.length === 1 &&
    (segments[0]!.type === NodeTypes.LiquidTag || segments[0]!.type === NodeTypes.LiquidRawTag)
  );
}
