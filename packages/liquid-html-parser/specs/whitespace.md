# Whitespace Handling in the Recursive Descent Parser

## 1. The Problem

The previous Ohm PEG parser handled whitespace through grammar rule casing:

- **Syntactic rules** (capitalized, e.g., `Node`, `AttrList`) auto-skip whitespace between sub-expressions. The parser silently consumes whitespace between each grammar term.
- **Lexical rules** (lowercase, e.g., `liquidNode`, `tagName`) do NOT auto-skip. Every character is significant.
- Once a syntactic rule calls a lexical rule, everything below is lexical.
- The `#()` operator creates **lexical islands** inside syntactic rules — suppressing auto-skip for a specific sub-expression.

The recursive descent parser has no auto-skip. Its tokenizer emits `Text` tokens for all inter-node content including whitespace. These become `TextNode` AST nodes. Without post-processing, every space, newline, and indent between tags appears as a `TextNode` in the AST — a deviation from the Ohm parser's output.

## 2. Where Auto-Skip Was Active (Ohm Grammar Analysis)

### Syntactic (auto-skip) contexts

These rules silently consumed whitespace between sub-expressions:

- `Node` — document root, block bodies, branch bodies, HTML element children
- `AttrList` / `Attr` — between attributes, around `=`
- HTML structural rules: `HtmlDoctype`, `HtmlComment`, `HtmlVoidElement`, `HtmlSelfClosingElement`, `HtmlTagOpen`, `HtmlTagClose`, `TagStart`, `TagEnd`, `HtmlRawTagImpl`
- `LiquidStatement` `Node` rule
- `LiquidDoc` `Node` rule

### Lexical (no auto-skip) contexts

These rules preserved every character:

- Entire `liquidNode` subtree (all Liquid tags, drops, expressions, filters)
- `yamlFrontmatter`
- `tagName`, `attrName`, attribute values (quoted and unquoted)
- All LiquidDoc annotation nodes (`paramNode`, `exampleNode`, etc.)

### Lexical islands (`#()`) inside syntactic rules

These suppressed auto-skip for specific sub-expressions within otherwise-syntactic rules:

- `<` to tagName boundary (`HtmlTagOpen`, `HtmlVoidElement`, etc.)
- Inside quoted attribute values
- `HtmlComment` body
- `HtmlDoctype` initial `<!DOCTYPE html>`

## 3. The Solution: ChildFilterMode

A `ChildFilterMode` enum in `tree-builder.ts` with a single `filterChildren(mode, children, source)` dispatch function. Three modes:

### `Syntactic`

Replicates Ohm's syntactic auto-skip. Merges adjacent TextNodes, trims leading/trailing whitespace at text/non-text boundaries, drops TextNodes reduced to empty. Implementation: `mergeAdjacentTextNodesTrimmed`.

### `Preserve`

Merges adjacent TextNodes for cleanliness, preserves all whitespace content. Used where whitespace IS significant. Implementation: `mergeAdjacentTextNodes`.

### `StripEdges`

Merges, then strips whitespace-only TextNodes from first/last positions only. Interior whitespace preserved. Implementation: `mergeAdjacentTextNodesStripEdges`.

## 4. Call-Site Mapping

Every site that collects children calls `filterChildren` with an explicit mode. The mode depends on context.

| Context                                                               | Mode                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------------- |
| Document root (`parser.ts`, `parseDocument`)                          | `Syntactic` (always)                                  |
| Block body — normal close (`liquid-blocks.ts`, `parseBlockBody`)      | `Syntactic` (always)                                  |
| Block body — unclosed/EOF (`liquid-blocks.ts`, `parseBlockBody`)      | `Syntactic` (always)                                  |
| Branch children (`liquid-blocks.ts`, `parseBranchedBlockBody`)        | `blockInAttributeValueContext ? Preserve : Syntactic` |
| HTML element children — unclosed (`html.ts`, `parseHtmlElementInner`) | `Syntactic` (always)                                  |
| HTML element children — closed (`html.ts`, `parseHtmlElementInner`)   | `Syntactic` (always)                                  |
| Liquid-in-range body (`liquid-raw.ts`, `parseLiquidInRange`)          | `Syntactic` (always)                                  |
| LiquidStatement body                                                  | (no merge — line-based, no TextNodes)                 |
| LiquidDoc body                                                        | (no merge — separate tokenizer domain)                |

The only context-dependent mode is branch children: when `blockInAttributeValueContext` is true (a block tag appears inside an HTML attribute value), branches use `Preserve` to avoid stripping significant whitespace. All other contexts use `Syntactic` unconditionally.

### `finalizeBranch` detail

`finalizeBranch` in `liquid-blocks.ts` accepts a `mode: ChildFilterMode` parameter with a default of `ChildFilterMode.StripEdges` (unreachable in practice — all callers pass an explicit mode). It computes `branch.position.end` from a Preserve-merged array (for accurate positions), then applies the requested mode for the actual children.

```
finalizeBranch(branch, children, endPos, source, mode: ChildFilterMode = ChildFilterMode.StripEdges):
  allMerged = mergeAdjacentTextNodes(children)       // for position.end
  branch.children = filterChildren(mode, children, source)
  branch.blockEndPosition = { start: endPos, end: endPos }
  branch.position.end = endPos
  if allMerged.length > 0:
    branch.position.end = max(endPos, lastChild.position.end)
```

## 5. Design Rationale

**Post-processing, not parser state.** The merge mode varies per call site, not per parser instance. The same parser parses block bodies (Syntactic) and branches (Syntactic or Preserve) in sequence. A parser-level mode would require toggling state for every child-collection scope.

**Enum + dispatch function, not ad-hoc ternaries.** `ChildFilterMode` enum with `filterChildren(mode, children, source)` centralizes the merge function selection. `assertNever` on the enum ensures exhaustive dispatch. Call sites pass the mode explicitly — no scattered ternaries selecting between function references.

**Mode does NOT go on delegate interfaces.** The merge mode varies per call site within the same delegate (block body = Syntactic, branch = Syntactic or Preserve, same `BlockParserDelegate`). A delegate getter would suggest one mode per parser instance, which is wrong.

**The Ohm parser's grammar boundaries were the original ground truth.** Ohm's syntactic/lexical distinction was the original whitespace mechanism — no code existed to replicate because the behavior was embedded in the grammar engine. The recursive descent parser replicates those boundaries in post-processing because it has no grammar engine to do it implicitly.

**Syntactic for document root.** The `Node` rule is syntactic — whitespace between all top-level nodes is auto-skipped. Both HTML and non-HTML mode use Syntactic at document root.

**Syntactic for block bodies and HTML elements.** Block bodies and HTML element children use Syntactic unconditionally. This matches the Ohm parser's behavior where the `Node` rule (syntactic) governs these contexts.

**Preserve for branch children in attribute value context only.** When a block tag appears inside an HTML attribute value (`blockInAttributeValueContext`), whitespace between branch children is significant content. All other branch contexts use Syntactic.
