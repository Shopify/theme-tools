# Architecture: Recursive Descent Liquid+HTML Parser

A recursive descent parser that consumes tokens and builds the AST directly (see Section 2 for domain model). Key traits:

- **Direct nesting:** The parser sees an open tag, parses children until the close tag, and nests them inline (see Data Flow).
- **Modal tokenizer:** A document tokenizer identifies structural delimiters including HTML attribute tokens (`=`, quotes).
- **Tag dispatch:** Tags register in an `Environment` via discriminated `TagDefinition` unions keyed on `TagKind`.
- **Factories:** AST node factories centralize whitespace computation and type narrowing.
- **Expression adapter:** Converts internal `BinaryExpression` nodes to frozen `LiquidLogicalExpression`/`LiquidComparison`/`LiquidBooleanExpression` types.

### Frozen files

`ast.ts`, `types.ts`, `errors.ts` are frozen: type definitions, enums, and the error class cannot be modified. Additive changes are OK (new optional fields, new sub-unions, new exports). The `toLiquidAST`/`toLiquidHtmlAST` stubs are meant to be filled with parser calls.

---

## 1. File Tree

```
src/
  # Frozen (types, enums, errors)
  ast.ts                  types.ts            errors.ts
  grammar.ts              utils.ts            index.ts
  conditional-comment.ts

  # Shared infrastructure
  tag-definitions.ts      # TagKind, TagDefinition<M>, Parser interface, BranchName, LiquidLine, LiquidLineContext
  environment.ts          # Environment class, re-exports from tag-definitions.ts

  # Document domain -- top-level orchestration + HTML
  document/
    base.ts               # ParserBase: shared token consumption primitives (consume, accept, check, peek, advance, isAtEnd)
    parser.ts             # DocumentParser extends ParserBase, delegates to free functions via interfaces
    node-dispatch.ts      # parseNode(): token-type switch dispatching to appropriate parse function
    factories.ts          # LiquidTagEnvelope, envelopeFromTokens, 20 node factories
    tree-builder.ts       # filterChildren, ChildFilterMode, mergeAdjacentTextNodes[Trimmed|StripEdges], compoundNamesMatch
    tokenizer.ts          # Source -> Token[] (modal: HTML tag context with =, ", ')
    html.ts               # HTML element, void, self-closing, raw node, comment, doctype, dangling marker parsing
    liquid-blocks.ts      # Block tag body parsing, branched block parsing, finalizeBranch
    liquid-hybrid.ts      # Hybrid tag parsing (section standalone/block detection)
    liquid-lines.ts       # {% liquid %} line-based parsing, parseLiquidStatement
    liquid-raw.ts         # Raw tag body parsing, Liquid-in-range parsing
    liquid-tags.ts        # Tag dispatch: environment lookup, MarkupParser creation, tolerant fallback
    liquid-variable-output.ts  # {{ }} variable output parsing
    test-helpers.ts       # expectPath, expectPosition, expectBlockStartPosition test utilities

  # Markup domain -- Liquid expression grammar
  markup/
    tokenizer.ts          # MarkupTokenType enum, tokenizeMarkup()
    parser.ts             # MarkupParser class: consume, consumeOptional, look, id, valueExpression, expression, etc.
    expression-adapter.ts # BinaryExpression -> LiquidLogicalExpression/LiquidComparison adapter

  # Liquid Doc domain -- {% doc %} annotation grammar
  liquid-doc/
    tokenizer.ts          # Doc body tokenizer (annotations, text, whitespace)
    parser.ts             # @param, @example, @description, @prompt -> LiquidDoc nodes
    factories.ts          # makeLiquidDocParamNode, makeLiquidDocDescriptionNode, makeLiquidDocExampleNode, makeLiquidDocPromptNode

  # Shared utilities
  shared.ts               # envelopeFromLine()

  # Tag definitions (one file per tag)
  tags/
    index.ts              # builtinTags const record
    if.ts  for.ts  case.ts  assign.ts  echo.ts  render.ts  cycle.ts
    section.ts  form.ts  paginate.ts  content-for.ts  block.ts  liquid.ts
    raw.ts  increment.ts  decrement.ts  capture.ts  layout.ts  sections.ts
    partial.ts  ifchanged.ts  break.ts  continue.ts
```

---

## 2. Domain Model

Three parallel parsing domains (document, markup, liquid-doc). Each domain has its own tokenizer and parser. Each domain's parser consumes tokens only from its own tokenizer.

| Domain         | Tokenizer                                                                                            | Parser                                                                                               | Grammar                                 |
| -------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Document**   | `document/tokenizer.ts` -- modal, produces structural tokens (`{%`, `}}`, `<`, `=`, `"`, etc.)       | `document/parser.ts` -- dispatches tags, parses HTML elements/attributes, handles `{% liquid %}`     | Liquid tags, drops, HTML elements, text |
| **Markup**     | `markup/tokenizer.ts` -- expression-level tokens (Id, String, Dot, Pipe, Colon, Logical, Comparison) | `markup/parser.ts` -- `consume(type)`, `expression()`, `valueExpression()`, `filter()`, `argument()` | `product.title \| upcase`               |
| **Liquid Doc** | `liquid-doc/tokenizer.ts` -- annotation-level tokens (@-keywords, text, newlines)                    | `liquid-doc/parser.ts` -- `@param`, `@example`, `@description`, `@prompt`                            | `@param {String} name - desc`           |

HTML parsing is part of the document domain, not a separate domain. HTML tokens come from the document tokenizer; HTML elements, attributes, and compound names are parsed at the document level.

`tag-definitions.ts` is the canonical location for `TagKind`, `TagDefinition`, `Parser`, `BranchName`, `LiquidLine`, and `LiquidLineContext`. `environment.ts` re-exports these and owns the `Environment` class. `document/factories.ts` is document-domain infrastructure.

### Node Construction by Domain

- **`document/factories.ts`** -- factories for nodes containing Liquid/HTML: `DocumentNode`, `LiquidTag`, `LiquidBranch`, `LiquidRawTag`, `LiquidVariableOutput`, `HtmlElement`, `HtmlVoidElement`, `HtmlSelfClosingElement`, `HtmlRawNode`, `HtmlComment`, `HtmlDoctype`, `TextNode`, `YAMLFrontmatter`, attributes (`AttrDoubleQuoted`, `AttrSingleQuoted`, `AttrUnquoted`, `AttrEmpty`), `HtmlDanglingMarkerClose`, `RawMarkup`, etc. `LiquidTagEnvelope` and whitespace types live here.
- **Markup domain** -- no factories. Tags call `MarkupParser` primitives and assemble markup nodes directly.
- **`liquid-doc/factories.ts`** -- `makeLiquidDocParamNode`, `makeLiquidDocDescriptionNode`, `makeLiquidDocExampleNode`, `makeLiquidDocPromptNode`.

### Import Rules

- `markup/` imports from frozen types only -- no knowledge of document, tags, or liquid-doc.
- `liquid-doc/` imports from frozen types only.
- `tags/` imports from `markup/`, `tag-definitions.ts`, and `shared.ts` -- never from `document/`.
- `document/` imports from everything: `tag-definitions.ts`, `environment.ts`, `shared.ts`, `markup/`, `liquid-doc/`, `tags/` (via environment tag lookup).
- Sub-modules receive a `Parser` interface (defined in `tag-definitions.ts`), not the concrete parser class. No circular dependencies.

### Data Flow

```
document/tokenizer.ts
    | produces Token[] (flat: Liquid open/close, HTML open/close, text, =, ", ')
    v
document/parser.ts (DocumentParser)
    | extends ParserBase (base.ts), implements delegate interfaces
    | delegates to free functions via typed interfaces:
    |   - node-dispatch.ts: token-type switch -> parse function routing
    |   - liquid-tags.ts: tag dispatch (environment lookup, MarkupParser creation)
    |   - liquid-blocks.ts: block body + branched block parsing
    |   - liquid-hybrid.ts: hybrid tag (section) standalone/block detection
    |   - liquid-raw.ts: raw tag body extraction + Liquid-in-range parsing
    |   - liquid-variable-output.ts: {{ }} variable output
    |   - liquid-lines.ts: {% liquid %} line-based parsing
    |   - html.ts: HTML elements, attributes, comments, doctype, dangling markers
    |
    |--calls--> tags/*.ts --calls--> markup/parser.ts --uses--> markup/tokenizer.ts
    |                                   (returns expression/filter/argument nodes)
    |--calls--> liquid-doc/parser.ts --uses--> liquid-doc/tokenizer.ts
    |                                   (returns LiquidDoc nodes)
    |--uses---> document/factories.ts   (wraps results in LiquidTag/LiquidBranch/etc.)
    |--uses---> document/tree-builder.ts (utility: text merging, name matching)
    v
  DocumentNode (final AST)
```

### Delegate Pattern

`DocumentParser` extends `ParserBase` and implements multiple delegate interfaces (`TagParserDelegate`, `BlockParserDelegate`, `RawParserDelegate`, `HtmlParserDelegate`, `LineParserDelegate`, `NodeDispatchDelegate`). Each document module defines its own delegate interface specifying the parser properties and methods it needs. The parser class satisfies all interfaces; the free functions accept the interface type, not the concrete class.

### `document/tree-builder.ts` -- Utility Library

`tree-builder.ts` is NOT a separate pipeline stage. It is a utility library that the document parser calls during parsing:

- **`filterChildren(mode, children, source)`:** Dispatches to the appropriate merge function based on `ChildFilterMode` enum (`Syntactic`, `Preserve`, `StripEdges`). Uses `assertNever` for exhaustive dispatch.
- **`mergeAdjacentTextNodesTrimmed`:** Merge then trim whitespace at text/non-text boundaries, drop empty.
- **`mergeAdjacentTextNodesStripEdges`:** Merge then strip whitespace-only TextNodes from first/last positions.
- **`mergeAdjacentTextNodes`:** Merge only, preserve all content.
- **`compoundNamesMatch`:** Structural equality check for names like `<{{ type }}--header>`.

The parser calls these utilities while building the AST.

---

## 3. Module Responsibilities

| Module                               | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Does NOT do                                                                                                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `document/tokenizer.ts`              | Modal document tokenizer. Default mode: scan for `{%`, `%}`, `{{`, `}}`, `<`, `>`, `/>`, `</`, `<!--`, `-->`, `<!`, `---`. In HTML tag context: `=` emits `HtmlEquals`, quotes emit `HtmlQuoteOpen`/`HtmlQuoteClose`. Liquid delimiters take priority inside quoted attribute values. Produces flat `Token[]`.                                                                                                                                                                                                                                                                                                                                      | Expression parsing. Tag-internal parsing. AST construction.                                                                                                   |
| `document/base.ts`                   | `ParserBase` class: shared token consumption primitives (`consume`, `accept`, `check`, `peek`, `advance`, `isAtEnd`, `getSource`, `tokenAt`, `tokenCount`, `getPosition`, `setPosition`).                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Parsing logic. Node construction.                                                                                                                             |
| `document/parser.ts`                 | `DocumentParser extends ParserBase`. Implements all delegate interfaces. Owns parser-level state: `parseHtml`, `allowUnclosedHtml`, `allowUnclosedDocumentNode`, `inAttributeContext`, `inAttributeValueContext`. Delegates all parsing to free functions in sibling modules via typed interfaces.                                                                                                                                                                                                                                                                                                                                                  | Expression parsing (delegates to `MarkupParser`). Tag-specific markup (delegates to tag functions). Node construction (delegates to `document/factories.ts`). |
| `document/node-dispatch.ts`          | `parseNode()`: exhaustive switch on `TokenType` routing to the appropriate parse function. `parseYamlFrontmatter()`. `advanceAsText()`. Defines the `NodeDispatchDelegate` interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Liquid tag parsing. HTML element parsing. Expression parsing.                                                                                                 |
| `document/factories.ts`              | `LiquidTagEnvelope` type (with `markupEnd` field) and `envelopeFromTokens()`. Node factories: `makeDocumentNode`, `makeLiquidTagBaseCase`, `makeLiquidTagNamed`, `makeLiquidBranchUnnamed`, `makeLiquidBranchNamed`, `makeLiquidRawTag`, `makeLiquidVariableOutput`, `makeTextNode`, `makeYamlFrontmatter`, `makeHtmlElement`, `makeHtmlVoidElement`, `makeHtmlSelfClosingElement`, `makeHtmlRawNode`, `makeHtmlComment`, `makeHtmlDoctype`, `makeAttrDoubleQuoted`, `makeAttrSingleQuoted`, `makeAttrUnquoted`, `makeAttrEmpty`, `makeHtmlDanglingMarkerClose`, `makeRawMarkup`. Centralizes whitespace computation and `as LiquidTagNamed` casts. | Parsing. Dispatch.                                                                                                                                            |
| `document/tree-builder.ts`           | Utility functions for the parser: `filterChildren`, `ChildFilterMode`, `mergeAdjacentTextNodes`, `mergeAdjacentTextNodesTrimmed`, `mergeAdjacentTextNodesStripEdges`, `compoundNamesMatch`. Pure functions, zero parser state.                                                                                                                                                                                                                                                                                                                                                                                                                      | Tokenizing. Parsing. Dispatch.                                                                                                                                |
| `document/html.ts`                   | HTML element parsing (open/close matching, unclosed element handling), void elements, self-closing elements, raw HTML nodes (`<script>`, `<style>`, `<svg>`), comments, doctype, dangling marker close. Attribute parsing. Defines `HtmlParserDelegate` interface.                                                                                                                                                                                                                                                                                                                                                                                  | Liquid tag parsing. Expression parsing.                                                                                                                       |
| `document/liquid-blocks.ts`          | Block tag body parsing (`parseBlockBody`), branched block parsing (`parseBranchedBlockBody`), `finalizeBranch`, `peekTagName`, `isBlockTerminator`, `consumeEndTag`. Defines `BlockParserDelegate` interface.                                                                                                                                                                                                                                                                                                                                                                                                                                       | Tag dispatch. Expression parsing. HTML parsing.                                                                                                               |
| `document/liquid-hybrid.ts`          | Hybrid tag detection: scans forward in token array for matching end tag. Defines `HybridParserDelegate` interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Tag dispatch. Expression parsing.                                                                                                                             |
| `document/liquid-lines.ts`           | `{% liquid %}` line-based parsing: `parseLiquidStatement`, line splitting, block nesting within liquid tags. Defines `LineParserDelegate` interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Document tokenization. HTML parsing.                                                                                                                          |
| `document/liquid-raw.ts`             | Raw tag body extraction (scan forward for end tag). `parseLiquidInRange` for tags that parse Liquid inside their body. Defines `RawParserDelegate` interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Expression parsing. Tag dispatch.                                                                                                                             |
| `document/liquid-tags.ts`            | Tag dispatch: environment lookup, `MarkupParser` creation from envelope, tolerant-mode try/catch fallback to base case. Defines `TagParserDelegate` interface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Block body parsing. HTML parsing.                                                                                                                             |
| `document/liquid-variable-output.ts` | `{{ }}` variable output parsing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Everything else.                                                                                                                                              |
| `document/test-helpers.ts`           | Test utilities: `expectPath`, `expectPosition`, `expectBlockStartPosition`, `expectBlockEndPosition`, `sourceAt`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Production code.                                                                                                                                              |
| `shared.ts`                          | `envelopeFromLine()`: constructs `LiquidTagEnvelope` from a `{% liquid %}` line. Shared so both `document/parser.ts` and `tags/liquid.ts` can import it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Everything else.                                                                                                                                              |
| `tag-definitions.ts`                 | `TagKind` enum, `TagDefinition<M>` discriminated union, `Parser` interface, `BranchName` type, `LiquidLine` and `LiquidLineContext` types.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Parsing logic. Environment management.                                                                                                                        |
| `environment.ts`                     | `Environment` class (tag registry, `tagForName`, `registerTag`, `Environment.default()` singleton). Re-exports all types from `tag-definitions.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Parsing logic.                                                                                                                                                |
| `markup/parser.ts`                   | `MarkupParser` class: token-level primitives (`consume`, `consumeOptional`, `look`, `peek`, `isAtEnd`). `id(keyword)` for markup-specific keyword matching. Two expression entry points: `valueExpression()` (leaf only), `expression()`/`conditionalExpression()` (full union including binary ops). Filter/argument/variable/liquidVariable primitives. Position tracking relative to document source. Constructor accepts optional `markupStart` and `markupEnd` params.                                                                                                                                                                         | Document structure. HTML. Tag dispatch.                                                                                                                       |
| `markup/tokenizer.ts`                | `MarkupTokenType` enum. `tokenizeMarkup()`: markup string -> `MarkupToken[]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Parsing. AST construction.                                                                                                                                    |
| `markup/expression-adapter.ts`       | Internal `Expression = BinaryExpr \| ValueExpression` types. `LogicalBinaryExpression` includes `opStart: number` field for operator position tracking. `adaptConditional()`: Expression -> `LiquidConditionalExpression`. `adaptComplex()`: Expression -> `ComplexLiquidExpression` (wraps binary ops in `LiquidBooleanExpression`).                                                                                                                                                                                                                                                                                                               | Parsing. Everything else.                                                                                                                                     |
| `liquid-doc/tokenizer.ts`            | Doc body tokenizer: annotation tokens, text tokens, whitespace tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Parsing. AST construction.                                                                                                                                    |
| `liquid-doc/parser.ts`               | Parse `{% doc %}` body into `LiquidDocParamNode`, `LiquidDocDescriptionNode`, `LiquidDocExampleNode`, `LiquidDocPromptNode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Everything else.                                                                                                                                              |
| `liquid-doc/factories.ts`            | Doc node factories: `makeLiquidDocParamNode`, `makeLiquidDocDescriptionNode`, `makeLiquidDocExampleNode`, `makeLiquidDocPromptNode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Everything else.                                                                                                                                              |
| `tags/*.ts`                          | Each file exports one or more `TagDefinition` values. Parse function receives `(name: string, markup: MarkupParser, parser: Parser)` and returns typed markup using `MarkupParser` primitives.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Document structure. Token scanning.                                                                                                                           |

---

## 4. Type Signatures

### Parser Primitives

The document parser (`ParserBase` in `document/base.ts`) and markup parser (`MarkupParser` in `markup/parser.ts`) both provide token consumption primitives, with different method names:

| Operation        | `ParserBase` (document) | `MarkupParser` (markup) |
| ---------------- | ----------------------- | ----------------------- |
| Consume required | `consume(type)`         | `consume(type)`         |
| Consume optional | `accept(type)`          | `consumeOptional(type)` |
| Lookahead check  | `check(type, ahead?)`   | `look(type, ahead?)`    |
| Peek current     | `peek()`                | `peek()`                |
| Advance any      | `advance()`             | `advance()`             |
| At end?          | `isAtEnd()`             | `isAtEnd()`             |
| Keyword match    | —                       | `id(keyword)`           |

### Token and TokenType

```typescript
// document/tokenizer.ts

enum TokenType {
  // Liquid delimiters
  LiquidTagOpen, // {% or {%-
  LiquidTagClose, // %} or -%}
  LiquidVariableOutputOpen, // {{ or {{-
  LiquidVariableOutputClose, // }} or -}}

  // HTML structural delimiters
  HtmlTagOpen, // <  (not followed by / or !)
  HtmlCloseTagOpen, // </
  HtmlTagClose, // >
  HtmlSelfClose, // />
  HtmlCommentOpen, // <!--
  HtmlCommentClose, // -->
  HtmlDoctypeOpen, // <! (not followed by --)

  // HTML attribute tokens (emitted only in HTML tag context)
  HtmlEquals, // =
  HtmlQuoteOpen, // " or ' (opening)
  HtmlQuoteClose, // " or ' (closing, matches opening)

  // Other
  YamlFrontmatter, // ---\n...\n---  (only at document start)
  Text, // everything between structural delimiters
  EndOfInput, // sentinel
}

interface Token {
  type: TokenType;
  start: number; // byte offset in source, inclusive
  end: number; // byte offset in source, exclusive
}

function tokenize(source: string): Token[];
```

The tokenizer is modal. After emitting `HtmlTagOpen` or `HtmlCloseTagOpen`, it enters **HTML tag context** where `=` and quotes are significant. It exits HTML tag context on `HtmlTagClose`, `HtmlSelfClose`, or any Liquid open delimiter. Inside quoted attribute values, Liquid delimiters (`{{`, `{%`) take priority and are emitted as their own tokens; the quote context resumes after the Liquid close delimiter.

Tag name extraction is not tokenized. The parser slices the first word from the `Text` token content between `{%` and `%}`. No `LiquidTagName` token type.

When `parseHtml` is false (`toLiquidAST`), the parser ignores HTML token types and accumulates them into `TextNode`. One tokenizer, two parser modes.

### MarkupTokenType and MarkupParser

```typescript
// markup/tokenizer.ts

enum MarkupTokenType {
  Id,
  String,
  Number,
  Dot,
  DotDot,
  Pipe,
  Colon,
  Comma,
  OpenRound,
  CloseRound,
  OpenSquare,
  CloseSquare,
  Dash,
  Comparison,
  Equality,
  Logical,
  EndOfString,
}

interface MarkupToken {
  type: MarkupTokenType;
  value: string;
  start: number; // document-relative byte offset
  end: number; // document-relative byte offset
}

function tokenizeMarkup(markup: string, startOffset: number): MarkupToken[];
```

```typescript
// markup/parser.ts

class MarkupParser {
  constructor(tokens: MarkupToken[], source: string, markupStart?: number, markupEnd?: number);

  // Token primitives
  consume(type: MarkupTokenType): MarkupToken;
  consumeOptional(type: MarkupTokenType): MarkupToken | null;
  look(type: MarkupTokenType, ahead?: number): boolean;
  peek(): MarkupToken;
  advance(): MarkupToken;
  id(keyword: string): boolean; // markup-specific: accept Id with matching value
  isAtEnd(): boolean;
  remainingSource(): string;
  bodyContext(): { source: string; bodyStart: number; bodyEnd: number };

  // Expression entry points
  valueExpression(): LiquidExpression; // leaf only
  expression(): ComplexLiquidExpression; // full union via adaptComplex
  conditionalExpression(): LiquidConditionalExpression; // full union via adaptConditional
  liquidVariable(): LiquidVariable; // expression + filters

  // Structured primitives
  variableLookup(): LiquidVariableLookup;
  filter(): LiquidFilter;
  filters(): LiquidFilter[];
  argument(): LiquidArgument;
  namedArgument(): LiquidNamedArgument;
  arguments(): LiquidArgument[];
  namedArguments(): LiquidNamedArgument[];
}
```

Two expression entry points:

- `valueExpression()` parses leaf types only (`LiquidExpression`): string, number, literal, range, variableLookup. Used by `for.collection`, `case` markup, `paginate.collection`, filter arguments, named argument values.
- `expression()` / `conditionalExpression()` parse the full union including binary ops. Internally, precedence-climbing via `logicalExpr()` -> `comparison()` -> `valueExpression()`. The result is adapted at the boundary:
  - `conditionalExpression()` calls `adaptConditional()` for if/unless/elsif markup
  - `expression()` calls `adaptComplex()` for `{{ }}`/echo markup (wraps binary ops in `LiquidBooleanExpression`)

### Expression Adapter

```typescript
// markup/expression-adapter.ts

type ValueExpression = LiquidExpression;

interface ComparisonBinaryExpression {
  kind: "comparison";
  left: LiquidExpression;
  op: EqualityOperator | ComparisonOperator;
  right: LiquidExpression;
  position: Position;
  source: string;
}

interface LogicalBinaryExpression {
  kind: "logical";
  left: BinaryExpr | LiquidExpression;
  op: LogicalOperator;
  right: BinaryExpr | LiquidExpression;
  opStart: number; // start offset of the operator keyword (and/or)
  position: Position;
  source: string;
}

type BinaryExpr = ComparisonBinaryExpression | LogicalBinaryExpression;
type Expression = BinaryExpr | ValueExpression;

function adaptConditional(node: Expression): LiquidConditionalExpression;
function adaptComplex(node: Expression): ComplexLiquidExpression;
```

The adapter is a recursive tree transform that converts internal `BinaryExpr` nodes to the frozen AST types. `kind: 'comparison'` and `kind: 'logical'` form a discriminated union with exhaustive dispatch.

### LiquidTagEnvelope and Factories

```typescript
// document/factories.ts

type LiquidOpenWhitespace = "-" | "";
type LiquidCloseWhitespace = "-" | "";

/**
 * Unified intermediate shape for both token-based and {% liquid %} paths.
 * Contains everything needed to construct a LiquidTag, LiquidBranch,
 * or LiquidRawTag -- without the parsed markup or children.
 */
interface LiquidTagEnvelope {
  tagName: string;
  markupString: string; // raw markup between tag name and close delimiter
  markupOffset: number; // document offset where markup starts
  markupEnd: number; // document offset where markup ends (exclusive)
  whitespaceStart: LiquidOpenWhitespace;
  whitespaceEnd: LiquidCloseWhitespace;
  blockStartPosition: Position; // span of the opening tag (or zero-width for liquid lines)
  source: string;
}

/**
 * Construct envelope from document tokens ({% tagName markup %}).
 * Centralizes all whitespace extraction: reads trim markers from
 * LiquidTagOpen/LiquidTagClose tokens.
 */
function envelopeFromTokens(openToken: Token, closeToken: Token, source: string): LiquidTagEnvelope;
```

```typescript
// shared.ts

// Construct envelope from a {% liquid %} line.
function envelopeFromLine(line: LiquidLine, source: string): LiquidTagEnvelope;
```

### Node Factories

```typescript
// document/factories.ts

function makeDocumentNode(children, source): DocumentNode;
function makeLiquidTagBaseCase(
  envelope,
  children?,
  blockEndPosition?,
  delimiterWhitespace?,
): LiquidTagBaseCase;
function makeLiquidTagNamed(
  envelope,
  markup,
  children?,
  blockEndPosition?,
  delimiterWhitespace?,
): LiquidTagNamed;
function makeLiquidBranchUnnamed(bodyStart, source): LiquidBranchUnnamed;
function makeLiquidBranchNamed(envelope, markup): LiquidBranchNamed;
function makeLiquidRawTag(envelope, body, blockEndPosition, delimiterWhitespace): LiquidRawTag;
function makeLiquidVariableOutput(openToken, closeToken, markup, source): LiquidVariableOutput;
function makeTextNode(value, start, end, source): TextNode;
function makeYamlFrontmatter(body, start, end, source): YAMLFrontmatter;
function makeHtmlElement(
  name,
  attributes,
  children,
  blockStartPosition,
  blockEndPosition,
  source,
): HtmlElement;
function makeHtmlVoidElement(name, attributes, position, source): HtmlVoidElement;
function makeHtmlSelfClosingElement(name, attributes, position, source): HtmlSelfClosingElement;
function makeHtmlRawNode(
  name,
  attributes,
  body,
  blockStartPosition,
  blockEndPosition,
  source,
): HtmlRawNode;
function makeHtmlComment(body, start, end, source): HtmlComment;
function makeHtmlDoctype(legacyDoctypeString, start, end, source): HtmlDoctype;
function makeAttrDoubleQuoted(name, value, attributePosition, position, source): AttrDoubleQuoted;
function makeAttrSingleQuoted(name, value, attributePosition, position, source): AttrSingleQuoted;
function makeAttrUnquoted(name, value, attributePosition, position, source): AttrUnquoted;
function makeAttrEmpty(name, position, source): AttrEmpty;
function makeHtmlDanglingMarkerClose(
  name,
  blockStartPosition,
  position,
  source,
): HtmlDanglingMarkerClose;
function makeRawMarkup(kind, value, nodes, start, end, source): RawMarkup;
```

### Parser Interface

```typescript
// tag-definitions.ts

/**
 * Structural interface sub-modules receive instead of importing the
 * concrete parser class. Breaks circular dependencies.
 */
interface Parser {
  parseLiquidStatement(
    tagName: string,
    markupString: string,
    startOffset: number,
    ctx: LiquidLineContext,
  ): LiquidStatement;
}
```

### LiquidLine and LiquidLineContext

```typescript
// tag-definitions.ts

/** A parsed line from a {% liquid %} body. */
interface LiquidLine {
  tagName: string;
  markup: string;
  markupOffset: number; // document-relative offset where markup starts
  nameOffset: number; // document-relative offset where tag name starts
  lineEnd: number; // document-relative offset of end of line content
}

/** Shared mutable iterator over parsed lines within a {% liquid %} body. */
interface LiquidLineContext {
  readonly lines: readonly LiquidLine[];
  index: number;
}
```

### TagDefinition (Discriminated Union)

```typescript
// tag-definitions.ts

enum TagKind {
  Block = "block",
  Tag = "tag",
  Raw = "raw",
  Hybrid = "hybrid",
}

type BranchName = "elsif" | "else" | "when";

interface TagDefinitionBlock<M = unknown> {
  kind: TagKind.Block;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
  branches: BranchName[];
}

interface TagDefinitionTag<M = unknown> {
  kind: TagKind.Tag;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
}

interface TagDefinitionRaw<M = unknown> {
  kind: TagKind.Raw;
  parseLiquidInBody?: boolean;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
}

interface TagDefinitionHybrid<M = unknown> {
  kind: TagKind.Hybrid;
  parse(name: string, markup: MarkupParser, parser: Parser): M;
}

type TagDefinition<M = unknown> =
  | TagDefinitionBlock<M>
  | TagDefinitionTag<M>
  | TagDefinitionRaw<M>
  | TagDefinitionHybrid<M>;
```

Dispatch uses switch + `assertNever`:

```typescript
switch (def.kind) {
  case TagKind.Block:       return parseBlockTag(...);
  case TagKind.Tag:         return parseTag(...);
  case TagKind.Raw:         return parseRawTag(...);
  case TagKind.Hybrid:      return parseHybridTag(...);
  default:                  return assertNever(def);
}
```

Branch tags (`elsif`, `else`, `when`) are NOT registered as top-level tags. They are declared in their parent block's `branches` array. The parent block's parsing loop handles branch dispatch.

### Tree Builder Utilities

```typescript
// document/tree-builder.ts

enum ChildFilterMode {
  Syntactic,
  Preserve,
  StripEdges,
}

function filterChildren(
  mode: ChildFilterMode,
  children: LiquidHtmlNode[],
  source: string,
): LiquidHtmlNode[];
function mergeAdjacentTextNodes(nodes: LiquidHtmlNode[], source: string): LiquidHtmlNode[];
function mergeAdjacentTextNodesTrimmed(nodes: LiquidHtmlNode[], source: string): LiquidHtmlNode[];
function mergeAdjacentTextNodesStripEdges(
  nodes: LiquidHtmlNode[],
  source: string,
): LiquidHtmlNode[];
function compoundNamesMatch(a: LiquidHtmlNode[], b: LiquidHtmlNode[]): boolean;
```

### Error Type

```typescript
// errors.ts (frozen)

type UnclosedNode = { type: NodeTypes; name: string; blockStartPosition: Position };

class LiquidHTMLASTParsingError extends SyntaxError {
  loc?: { start: LineColPosition; end: LineColPosition };
  unclosed: UnclosedNode | null;

  constructor(
    message: string,
    source: string,
    startIndex: number,
    endIndex: number,
    unclosed?: UnclosedNode,
  );
  // Note: this.name is set to 'LiquidHTMLParsingError' (without "AST")
}
```

### HTML Attribute Types

HTML attributes are parsed at the token level using `HtmlEquals`, `HtmlQuoteOpen`, `HtmlQuoteClose` tokens (no string scanning). The frozen `ast.ts` defines four `AttributeNode` variants:

- `AttrDoubleQuoted` -- `<tag attr="value">`
- `AttrSingleQuoted` -- `<tag attr='value'>`
- `AttrUnquoted` -- `<tag attr=value>`
- `AttrEmpty` -- `<tag attr>`

All except `AttrEmpty` extend `AttributeNodeBase<T>` with `name: (TextNode | LiquidVariableOutput)[]`, `value: ValueNode[]`, `attributePosition: Position`. `AttrEmpty` has only `name`. Liquid nodes (`LiquidVariableOutput`, `LiquidTag`, etc.) can also appear in the `AttributeNode` union for interpolated attributes. See frozen `ast.ts` for full node shapes.

### HtmlDanglingMarkerClose

Defined in frozen `ast.ts`. Produced when a `</tagName>` close tag does not match any open element AND the current context has `allowUnclosedHtml: true` (i.e., inside `if`/`unless`/`case` branches). Has `name: (TextNode | LiquidVariableOutput)[]` and `blockStartPosition: Position`.

---

## 5. Decisions Log

### D1: TagDefinition as discriminated union on `kind`

Tags define behavior via `kind: TagKind.Block | TagKind.Tag | TagKind.Raw | TagKind.Hybrid` with generic `Markup` parameter. Block tags declare `branches: BranchName[]`. The `kind` discriminant drives exhaustive dispatch (see Section 4, TagDefinition).

### D2: Internal BinaryExpression with adapter to frozen types

The parser internally uses `BinaryExpr { kind: 'comparison' | 'logical', left, op, right }`. The adapter converts to `LiquidLogicalExpression`/`LiquidComparison` via `adaptConditional()` and wraps in `LiquidBooleanExpression` via `adaptComplex()`. One recursive descent chain handles all binary operations. Adding operators requires only adapter changes.

### D3: RTL logical associativity

`and`/`or` have equal precedence and are RIGHT-TO-LEFT associative. `a and b or c` parses as `and(a, or(b, c))`. Despite the spec saying "left-associative," the Ruby parser implements RTL, and the 740 golden test fixtures are ground truth. `logicalExpr()` recursively calls `logicalExpr()` for the right side.

### D4: Two expression entry points

`valueExpression()` -> leaf types only. `expression()`/`conditionalExpression()` -> full union. See MarkupParser type signatures for details.

### D5: Modal document tokenizer

After `<` (tag open), the tokenizer enters HTML tag context, emitting `HtmlEquals`, `HtmlQuoteOpen`, `HtmlQuoteClose`. Liquid delimiters take priority inside quoted values. This eliminates all character-level scanning in the parser for attributes.

Tag name extraction stays simple: slice first word from content between `{%` and `%}`. No `LiquidTagName` token.

### D6: Parser nests as it goes

The parser consumes tokens and builds the AST directly. For Liquid blocks: sees open tag, parses children until close tag. For HTML: sees `<div>`, parses children until `</div>`. No flat marker stream; `tree-builder.ts` is a utility library (see Section 2, Data Flow).

### D7: Parser interface for sub-modules

Tag parse functions and `tags/liquid.ts` receive a `Parser` interface (defined in `tag-definitions.ts`) instead of importing the concrete parser class. Breaks circular dependencies.

### D8: Switch statements for token dispatch

Token type dispatch uses exhaustive switch, not if-chains.

### D9: Three parallel domains

See Section 2 for domain table and import rules.

### D10: parseHtml as separate config

`parseHtml: boolean` is a separate config on the Parser constructor, not part of `ASTBuildOptions`. HTML-vs-Liquid mode is orthogonal to error mode. Set by entry point functions, never exposed to callers.

### D11: Flat token array

Tokenizer produces flat `[LiquidTagOpen, Text, LiquidTagClose, ...]`. Parser matches pairs by consuming forward. Pairing is the parser's job.

### D12: Section hybrid detection via lookahead

When parser encounters `{% section %}`, it scans forward in the token array for `{% endsection %}`. The array is materialized, so scanning is a cheap index walk.

### D13: HTML parsing in the document domain

See Section 2 domain table. HTML is parsed in `document/parser.ts`, not a separate domain.

---

## 6. Deep Dives

### 6.1 Branch Position Tracking

Every `LiquidBranch` has `blockStartPosition` and `blockEndPosition`, both `Position { start, end }`.

**Unnamed branch (first implicit branch of any branched tag):**

```liquid
{% if cond %}
  body here
{% elsif cond2 %}
```

- `blockStartPosition`: zero-width, `{ start: X, end: X }` where X is the byte offset immediately after `%}` of the opening tag.
- `blockEndPosition`: zero-width, `{ start: Y, end: Y }` where Y is the byte offset of the `{%` of the next branch tag or end tag.

**Named branch (elsif, when, else):**

```liquid
{% elsif cond2 %}
  body here
{% else %}
```

- `blockStartPosition`: spans the entire branch tag, `{ start: offset of '{%', end: offset after '%}' }`.
- `blockEndPosition`: zero-width, `{ start: Y, end: Y }` where Y is the byte offset of the `{%` of the next branch tag or end tag.

**Key invariant:** `blockEndPosition` on branches is ALWAYS zero-width. It marks a boundary, not a tag span.

**Unnamed branch whitespace fields:** `whitespaceStart: ''`, `whitespaceEnd: ''` (no physical branch tag).

### 6.2 Unclosed Node Handling

Two distinct contexts for unclosed HTML nodes:

**Conditional context (if/unless/case branches):** Unclosed HTML is valid.

```liquid
{% if condition %}
  <div>
{% else %}
  </div>
{% endif %}
```

The unclosed `<div>` in the if-branch is allowed. The `</div>` in the else-branch becomes `HtmlDanglingMarkerClose`.

**Non-conditional context (for/tablerow/form and document level):** Unclosed HTML is an error, throws `LiquidHTMLASTParsingError`.

**Block context flags:**

| Block tag                                                                         | `allowUnclosedHtml`                    |
| --------------------------------------------------------------------------------- | -------------------------------------- |
| `if`, `unless`, `case`                                                            | `true`                                 |
| `for`, `tablerow`, `form`, `capture`, `paginate`, `block`, `ifchanged`, `partial` | `false`                                |
| document (top level)                                                              | per `allowUnclosedDocumentNode` option |

When the parser finishes a branch body and there are open HTML elements on the stack:

- `allowUnclosedHtml` true: silently close them (elements without `blockEndPosition`).
- `allowUnclosedHtml` false: throw `LiquidHTMLASTParsingError`.

**Compound HTML name matching:** Tag names can contain Liquid drops: `<{{ header_type }}--header>`. Matching compares structurally: same number of segments, each `TextNode` segment has the same `value`, each `LiquidVariableOutput` segment has the same `markup` string.

### 6.3 `{% liquid %}` Tag

Registered as `TagKind.Tag`. Its parse function receives a `Parser` interface and uses `parseLiquidStatement()` to dispatch each line. It reuses `LiquidTagEnvelope` (via `envelopeFromLine`) and the same factory functions as the token-based path. It does NOT produce markers for tree-builder -- it resolves its own internal nesting via `parseLiquidStatement()`.

**Markup type:** `LiquidTagLiquid` has `markup: LiquidStatement[]`.

**Line-based dispatch:**

```
liquid tag parse(name, markupParser, parser):
  body = markupParser.bodyContext()  // source slice between {% liquid and %}
  lines = parseLines(body)           // split, skip empty lines, compute offsets
  ctx = { lines, index: 0 }

  while ctx.index < ctx.lines.length:
    line = ctx.lines[ctx.index]
    ctx.index++
    envelope = envelopeFromLine(line, source)
    statement = parser.parseLiquidStatement(
      line.tagName, line.markup, line.markupOffset, ctx
    )
    statements.push(statement)

  return statements
```

**Position tracking:** All positions are document-relative. `markupOffset` is computed from the body start offset plus character position within the body.

**Block nesting:** Block tags inside `{% liquid %}` consume subsequent lines until their matching `end*` line, reusing `finalizeBranch()`.

**Raw tags inside `{% liquid %}`:** When the line is a raw tag (e.g., `comment`), subsequent lines are consumed until `endcomment`.

**Nested `{% liquid %}`:** Supported. Inner `liquid` tag processes its own body independently.

**No `{{ }}` syntax:** Inside `{% liquid %}`, use `echo` instead.

**Inline comments:** Lines starting with `#` are intercepted before environment lookup — `#` is not a valid identifier start, so normal tag name extraction (`content.split(/\s/)[0]`) cannot handle it. The parser checks `content.startsWith('#')` and short-circuits to produce `LiquidTag { name: '#', markup: 'rest of line' }` directly.

### 6.4 Section Hybrid Tag

`section` is the only hybrid tag: standalone (`{% section 'name' %}`) or block (`{% section 'name' %}...{% endsection %}`).

**Detection:** When parser encounters `{% section %}`, it scans forward in the token array for `{% endsection %}`, respecting nesting. If found, parse as block. Otherwise, standalone.

**Markup for both forms:** `SectionMarkup { name: LiquidString, args: LiquidNamedArgument[] }`. Same regardless of form. The difference is whether `children` is populated and `blockEndPosition` exists.

### 6.5 Tolerant Mode vs Completion Mode

**Tolerant mode** falls back to base case on markup parse failure but throws on structural errors:

- Markup parse failures (tag parse throws, unconsumed input) -> `LiquidTagBaseCase` / `LiquidVariableOutput { markup: string }`
- Structural errors (unclosed block tags, mismatched end tags, branch tags outside parent) -> ALWAYS throw `LiquidHTMLASTParsingError`

Fallback is per-tag. If `{% assign x = bad!markup %}` fails, only the `assign` tag falls back. Block tags that fail markup parsing become `LiquidTagBaseCase` but their children are still parsed.

**Completion mode** extends tolerant mode by also suppressing structural errors:

- No throws on unclosed tags at end of input. Unclosed `{% if %}` produces a valid `LiquidTag` with whatever children were collected.
- U+2588 (`\u2588`) is accepted as a valid identifier character.

Detailed behavior is specified in `recursive-descent.md`.

### 6.6 `when` Markup: Expression List with Separators

The `when` tag's markup is `LiquidExpression[]`, NOT a logical expression. `or` and `,` in `{% when val1, val2 or val3 %}` are value separators, producing three `LiquidExpression` entries.

```
when parse(name, markup):
  values = [markup.valueExpression()]
  while true:
    if markup.consumeOptional(MarkupTokenType.Comma):
      values.push(markup.valueExpression())
      continue
    if markup.look(MarkupTokenType.Logical) and markup.peek().value == 'or':
      markup.consume(MarkupTokenType.Logical)
      values.push(markup.valueExpression())
      continue
    break
  return values
```

Note: `or` is lexed as `MarkupTokenType.Logical`, not `Id`, so `id('or')` cannot match it. The explicit look+peek+consume pattern is required.

This matches Ruby's implementation. If `or` were treated as logical, `{% when a or b %}` would wrongly produce `LiquidLogicalExpression`. The frozen type `LiquidBranchWhen` has `markup: LiquidExpression[]`.

### 6.7 Entry Points

```
toLiquidHtmlAST(source, options?)
  1. Resolve environment:  options.environment ?? Environment.default()
  2. Tokenize:             tokenize(source) -> Token[]
  3. Create parser:        new DocumentParser(tokens, source, env, parseHtml: true, allowUnclosedDocumentNode)
  4. Parse:                parser.parseDocument() -> DocumentNode
  5. Return DocumentNode

toLiquidAST(source, options?)
  Same flow, but parseHtml: false and allowUnclosedDocumentNode defaults true.
  Parser treats HTML tokens as text -- no HtmlElement nodes produced.
```

### 6.8 Tag Dispatch

```
Parser sees LiquidTagOpen token
  |
  +-- Build envelope via envelopeFromTokens(openToken, closeToken, source)
  |
  +-- Three-layer dispatch:
  |
  +-- Layer 0: Inline comment interception
  |     tagName === '#' ? -> makeLiquidTagBaseCase(envelope) (short-circuit)
  |     # is not in builtinTags and never reaches env.tagForName()
  |
  +-- Layer 1: Environment lookup
  |     def = env.tagForName(tagName) -> TagDefinition | undefined
  |
  +-- If def is undefined:
  |     Is it an end tag (starts with 'end')? -> signal to caller (end-of-block)
  |     Is it a recognized branch tag for the current parent? -> signal to caller (branch)
  |     Otherwise -> makeLiquidTagBaseCase(envelope)
  |
  +-- def is defined. Switch on def.kind (with assertNever default):
        |
        +-- TagKind.Block ->
        |     Create MarkupParser from envelope
        |     Call def.parse(tagName, markupParser, parser) -> typed markup M
        |     Parse children until matching end tag, splitting on branches
        |     makeLiquidTagNamed(envelope, markup, children, endPos, endWs)
        |
        +-- TagKind.Tag ->
        |     Create MarkupParser, call def.parse -> typed markup M
        |     makeLiquidTagNamed(envelope, markup)
        |
        +-- TagKind.Raw ->
        |     Scan forward for matching {% endtagname %}
        |     Extract body string
        |     If def.parseLiquidInBody: parse Liquid inside body
        |     If tagName == 'doc': pass body to liquid-doc/parser
        |     makeLiquidRawTag(envelope, body, endPos, endWs)
        |
        +-- TagKind.Hybrid ->
        |     Scan forward for matching {% endtagname %}
        |     If found: parse as block
        |     If not found: parse as standalone
        |
        +-- default -> assertNever(def)
```

### 6.9 Branch Body Parsing

```
parseBranchedBlockBody(parentName, def, envelope):
  branches = []
  currentBranch = makeLiquidBranchUnnamed(bodyStart, source)
  currentChildren = []
  childFilterMode = blockInAttributeValueContext ? Preserve : Syntactic

  loop:
    node = parseNode()
    if node signals end-of-block for parentName:
      finalizeBranch(currentBranch, currentChildren, endPos, source, childFilterMode)
      push to branches
      break
    if node signals branch AND branchName in def.branches:
      finalizeBranch(currentBranch, currentChildren, branchPos, source, childFilterMode)
      push to branches
      parsedMarkup = parseBranchMarkup(branchName, markupString)
      currentBranch = makeLiquidBranchNamed(branchEnvelope, parsedMarkup)
      currentChildren = []
      continue
    if node is null (end of input):
      error: unclosed block tag
    push node to currentChildren

  return branches
```

`parseBranchMarkup()` is a switch on `branchName` that dispatches to the appropriate branch parse function. These are standalone exported functions in the tag files (e.g., `whenBranchParse` in `case.ts`, `elsifBranchParse` in `if.ts`) rather than methods on the `TagDefinition`. The `TagDefinition.branches` array declares **which** branch names are valid; the parser's `parseBranchMarkup` switch maps each name to its parse function. Branches with no markup (like `else`) return an empty string.

`finalizeBranch()` is a single function used by both the token-based path and the `{% liquid %}` path. The envelope abstraction makes this possible -- both paths produce the same `LiquidTagEnvelope` shape.
