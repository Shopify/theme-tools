# Spec: Recursive Descent Liquid+HTML Parser

## Public API

`toLiquidHtmlAST(source, options)` and `toLiquidAST(source, options)` parse Liquid (and optionally HTML) source into a typed AST. All oracle tests and parser specs pass.

Performance is not a constraint. Correctness first.

---

## Design Principles

### Composable, user-extensible tag parsing

Liquid parsing is composable and user-extensible, modeled after [Shopify/liquid](https://github.com/Shopify/liquid). Tags define their own parsing logic:

```typescript
const env = new Environment();
env.registerTag("foo", {
  kind: TagKind.Tag,
  parse(name: string, markup: MarkupParser, parser: Parser) {
    // tag-specific parsing using shared building blocks
  },
});

toLiquidAST(code, { environment: env });

// Without an environment, uses the default one (all built-in tags registered)
toLiquidAST(code); // equivalent to toLiquidAST(code, { environment: Environment.default() })
```

### MarkupParser — shared building blocks

`MarkupParser` provides building blocks for parsing tag markup, similar to `Parser` in [Shopify/liquid PR #2021](https://github.com/Shopify/liquid/pull/2021/files). It exposes primitives like:

- `parser.expression()` — parse a Liquid expression
- `parser.variableLookup()` — parse a variable lookup
- `parser.argument()` — parse positional or named arguments
- etc.

Tags delegate to these shared building blocks. Adding a new tag = writing a small `parse` function that composes these primitives. It never requires editing the parser core.

### Expression parsing modeled after Shopify/liquid

The expression grammar uses precedence-climbing recursive descent, with room to expand to boolean expressions everywhere, math expressions, etc. Each precedence level is its own method. Adding a new level = adding one method.

### Tokenizer strategy

The tokenizer focuses on high-level delimiters: `<`, `>`, `{%`, `%}`, `{{`, `}}`, and whatever else makes sense for HTML and Liquid structure. Tag-specific parsers handle their own markup via `MarkupParser`.

---

## The Type Contract

All AST node types are defined in `src/ast.ts`. External consumers depend on these types as a stable contract.

### Core abstraction

Every node extends `ASTNode<T>`:

```typescript
interface ASTNode<T> {
  type: T; // discriminant (NodeTypes enum value)
  position: Position; // { start: number, end: number } — 0-indexed byte offsets
  source: string; // the ENTIRE document source (same string ref on every node)
}
```

`node.source.slice(node.position.start, node.position.end)` gives the node's source text.

### Node type hierarchy

```
DocumentNode
  children: LiquidHtmlNode[]

LiquidHtmlNode (discriminated union of all traversable nodes)
  ├── TextNode                    { value: string }
  ├── YAMLFrontmatter             { body: string }
  ├── HtmlDoctype                 { legacyDoctypeString: string | null }
  ├── HtmlComment                 { body: string, children: (LiquidNode|TextNode)[] }
  │
  ├── LiquidVariableOutput        { markup: string | LiquidVariable, whitespace }
  │
  ├── LiquidRawTag                { name: RawTags, body: RawMarkup, markup: string }
  ├── LiquidTag                   { name, markup, children?, whitespace, positions }
  │   ├── LiquidTagNamed          (22 strictly-typed variants with typed markup)
  │   └── LiquidTagBaseCase       (fallback: markup is string)
  ├── LiquidBranch                { name, markup, children, whitespace, positions }
  │   ├── LiquidBranchUnnamed     (first branch of if/for/case — name: null)
  │   ├── LiquidBranchNamed       (elsif, when — typed markup)
  │   └── LiquidBranchBaseCase    (else, unknown — markup is string)
  │
  ├── HtmlElement                 { name: (TextNode|LiquidVariableOutput)[], children, attributes }
  ├── HtmlVoidElement             { name: string, attributes }
  ├── HtmlSelfClosingElement      { name: (TextNode|LiquidVariableOutput)[], attributes }
  ├── HtmlRawNode                 { name: string, body: RawMarkup, attributes }
  ├── HtmlDanglingMarkerClose     { name: (TextNode|LiquidVariableOutput)[] }
  │
  ├── AttributeNode               (AttrDoubleQuoted | AttrSingleQuoted | AttrUnquoted | AttrEmpty | LiquidNode)
  │
  ├── LiquidVariable              { expression, filters, rawSource }
  ├── LiquidFilter                { name, args }
  ├── LiquidNamedArgument         { name, value }
  │
  ├── LiquidExpression variants:
  │   ├── LiquidString            { value, single }
  │   ├── LiquidNumber            { value: string }
  │   ├── LiquidLiteral           { keyword, value } (true/false/nil/null/empty/blank)
  │   ├── LiquidRange             { start, end }
  │   └── LiquidVariableLookup    { name: string | null, lookups: LiquidExpression[] }
  │
  ├── LiquidLogicalExpression     { relation: 'and'|'or', left, right }
  ├── LiquidComparison            { comparator, left, right }
  ├── LiquidBooleanExpression     { condition: LiquidConditionalExpression }
  │
  ├── Tag-specific markup nodes:
  │   ├── AssignMarkup            { name, value: LiquidVariable }
  │   ├── BlockMarkup             { name: LiquidString, args }
  │   ├── ContentForMarkup        { contentForType: LiquidString, args }
  │   ├── CycleMarkup             { groupName, args }
  │   ├── ForMarkup               { variableName, collection, reversed, args }
  │   ├── PaginateMarkup          { collection, pageSize, args }
  │   ├── RawMarkup               { kind: RawMarkupKinds, value, nodes }
  │   ├── RenderMarkup            { snippet, variable, alias, args }
  │   ├── SectionMarkup           { name: LiquidString, args }
  │   ├── RenderVariableExpression { kind: 'for'|'with', name }
  │   ├── RenderAliasExpression   { value: string }
  │
  └── LiquidDoc nodes:
      ├── LiquidDocParamNode       { name: 'param', paramName, paramDescription, paramType, required }
      ├── LiquidDocDescriptionNode { name: 'description', content, isImplicit, isInline }
      ├── LiquidDocExampleNode     { name: 'example', content, isInline }
      └── LiquidDocPromptNode      { name: 'prompt', content }
```

---

## Language Grammar (informal)

This section describes the Liquid+HTML language the parser handles. It is NOT prescriptive about parser architecture — implement however you see fit.

### Document structure

```
document     := (yamlFrontmatter)? node*
node         := liquidTag | liquidDrop | htmlNode | textNode
```

### YAML Frontmatter

If the document starts with `---\n`, everything until the next `\n---` is YAML frontmatter.

### Liquid Tags `{% ... %}`

```
liquidTag    := '{%' whitespace? tagName markup whitespace? '%}'
whitespace   := '-'           (whitespace trim marker)
tagName      := identifier
markup       := (depends on tagName)
```

**Whitespace trim fields:**

For `{%- if cond -%}...{%- endif -%}`:

- **Opening tag** (`{% if %}`): `whitespaceStart: '-'`, `whitespaceEnd: '-'`
- **Closing tag** (`{% endif %}`): `delimiterWhitespaceStart: '-'`, `delimiterWhitespaceEnd: '-'`

Standalone tags (no close tag) have `delimiterWhitespaceStart`/`delimiterWhitespaceEnd` as `undefined`. Block tags have both sets. The value is `'-'` when the trim marker is present, `''` when absent.

**Tag categories:**

| Category                                 | Tags                                                                                                                                                    | Behavior                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Block** (open/close pair)              | `if`, `unless`, `case`, `for`, `tablerow`, `capture`, `ifchanged`, `form`, `paginate`, `block`, `partial`                                               | Has `{% endtagname %}`. Children parsed between open/close. |
| **Branching** (delimiters inside blocks) | `elsif`, `else`, `when`                                                                                                                                 | Creates `LiquidBranch` nodes inside parent block.           |
| **Raw** (body not parsed)                | `raw`, `comment`, `doc`, `javascript`, `schema`, `style`, `stylesheet`                                                                                  | Body is raw string until `{% endtagname %}`.                |
| **Standalone** (no close tag)            | `echo`, `assign`, `render`, `include`, `increment`, `decrement`, `cycle`, `layout`, `section`, `sections`, `content_for`, `break`, `continue`, `liquid` | Self-contained, no children.                                |

**Position fields on block tags and branches:**

Block tags (`LiquidTag` with children) have:

- `blockStartPosition` — spans the opening tag (`{% if cond %}`)
- `blockEndPosition` — spans the closing tag (`{% endif %}`), `undefined` if unclosed

`LiquidBranch` nodes have:

- **Unnamed branch** (first implicit branch): `blockStartPosition` is zero-width at body start, `blockEndPosition` is zero-width at the next branch tag (or end tag)
- **Named branch** (`elsif`, `when`, `else`): `blockStartPosition` spans the branch tag (`{% elsif cond %}`), `blockEndPosition` is zero-width at the next branch tag (or end tag)

`blockEndPosition` on branches is always present and always zero-width — it marks the boundary, not a tag.

**Branching rules:**

- `if`/`unless` can contain `elsif` and `else` branches
- `case` can contain `when` and `else` branches
- `for`/`tablerow` can contain `else` branch
- The **first** branch of any branched tag is an unnamed branch (`LiquidBranchUnnamed` with `name: null`)

**Raw tag bodies:**

Every raw tag definition carries a `body` rule (`RawBodyRule` in `tag-definitions.ts`), and one scanner (`document/raw-body.ts`) ends every raw body by it. The rule mirrors the Liquid class that parses the tag:

| Tag                                         | Liquid class                         | `delimiter` | `sameName` | `opaque`               | Closes in `{% liquid %}` |
| ------------------------------------------- | ------------------------------------ | ----------- | ---------- | ---------------------- | ------------------------ |
| `raw`, `javascript`, `schema`, `stylesheet` | `Liquid::Raw`                        | `trailing`  | `ignored`  | none                   | no                       |
| `doc`                                       | `Liquid::Doc`                        | `trailing`  | `rejected` | none                   | no                       |
| `comment`                                   | `Liquid::Comment`                    | `leading`   | `nests`    | `raw`                  | yes                      |
| `style`                                     | `Liquid::Block` (Shopify's `style`)  | `leading`   | `nests`    | the other six raw tags | yes                      |

- The body is read as the tokens `Liquid::Tokenizer` produces: a `{%` tag runs to the first `%}`, and a `{{` output runs to its first `}` (taking a second `}` with it), or through the `%}` of a `{%` that opens inside it
- `leading` names a `{% %}` token by the `#` or word that opens it (`BlockBody::FullToken`); `trailing` names it by its last tag and keeps any text before that tag in the body (`FullTokenPossiblyInvalid`). Either way markup after the name does not matter, so `{% endcomment xyz %}` closes and `{% endcommentXXXXX %}` does not
- `sameName` says what an inner tag with the tag's own name does: `nests` opens another level that its own end tag closes, `ignored` does nothing, and `rejected` throws, as Liquid raises `Nested doc tags are not allowed`
- An `opaque` inner tag is skipped whole, ending by its own rule, so a `{% endcomment %}` inside a `{% raw %}` inside a comment does not count
- A body that runs out of tokens before it closes throws, as Liquid raises `'<name>' tag was never closed`
- Inside `{% liquid %}` the same levels apply line by line, each line named by its leading `#` or word after ASCII-only indentation (a line indented with U+00A0 or other non-ASCII whitespace has no name, as in Liquid's `LiquidTagToken`). A `Liquid::Raw` or `Liquid::Doc` body never closes there, because a line cannot hold its `{% end<name> %}`

**Inline comments `{% # %}`:**

- `#` is a valid tag name, producing `LiquidTag` with `name: '#'` and `markup: string` (the rest of the line)
- Inside `{% liquid %}`, each `# text` line is an independent inline comment

**`{% liquid %}` tag:**

- Contains newline-separated Liquid statements (no `{%`/`%}` delimiters)
- Each line is matched as `tagName markup`
- Empty and whitespace-only lines are skipped
- Block tags (`if`, `for`, `case`, `unless`, `capture`, etc.) collect subsequent lines as children until their corresponding `end*` line
- Nesting is fully supported: `for` inside `if` inside `liquid` is valid
- Branch tags (`elsif`, `else`, `when`) work inside `{% liquid %}` blocks
- Blocks open and close within the same `{% liquid %}` boundary
- Raw tags (`comment`/`endcomment`, `raw`/`endraw`) work inside `{% liquid %}`, consuming lines until their end tag (a `comment` nests; see Comment bodies)
- Nested `{% liquid %}` inside `{% liquid %}` is supported (inner scope is per-line)
- There is no `{{ }}` syntax inside `{% liquid %}` — use `echo` instead
- `markup` is `LiquidStatement[]`

### Liquid Variable Output `{{ ... }}`

```
liquidVariableOutput := '{{' whitespace? liquidVariable whitespace? '}}'
liquidVariable       := expression filter*
filter               := '|' name (':' arguments)?
arguments            := argument (',' argument)*
argument             := namedArgument | expression
namedArgument        := identifier ':' expression
```

### Expressions

```
expression         := string | number | literal | range | variableLookup
string             := '"' ... '"' | "'" ... "'"
number             := digit+ ('.' digit+)?
literal            := 'true' | 'false' | 'nil' | 'null' | 'empty' | 'blank'
range              := '(' expression '..' expression ')'
variableLookup     := name lookup* | lookup+
lookup             := '.' name | '[' expression ']'
```

### Conditional Expressions (in `if`, `unless`, `elsif`)

```
conditionalExpr := logicalExpr
logicalExpr     := comparison (('and' | 'or') comparison)*
comparison      := expression (comparator expression)?
comparator      := '==' | '!=' | '<' | '>' | '<=' | '>=' | 'contains'
```

**Important:** `and`/`or` have equal precedence and are right-to-left associative (matches Ruby Liquid's `Parser#logical` which uses recursion on the right side). `a and b or c` parses as `and(a, or(b, c))`.

### Named Tag Markup

| Tag                      | Markup Structure                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `echo`                   | `LiquidVariable` (expression + filters)                                                     |
| `assign`                 | `name = LiquidVariable`                                                                     |
| `cycle`                  | `[groupName:] arg1, arg2, ...`                                                              |
| `for`, `tablerow`        | `variableName in collection [reversed] [limit:N] [offset:N]`                                |
| `if`, `unless`           | `conditionalExpr`                                                                           |
| `elsif`                  | `conditionalExpr`                                                                           |
| `when`                   | `expr1 [, expr2] [or expr3]` (note: `or` here is a value separator, not a logical operator) |
| `case`                   | `expression`                                                                                |
| `render`, `include`      | `snippet [(with\|for) variable [as alias]] [, kwargs]`                                      |
| `content_for`            | `'type' [, kwargs]`                                                                         |
| `paginate`               | `collection by pageSize [, kwargs]`                                                         |
| `form`                   | `arg1 [, arg2] [, kwargs]` → `LiquidArgument[]` (mixed positional and named)                |
| `section`                | `'name' [, kwargs]`                                                                         |
| `sections`               | `'groupName'`                                                                               |
| `block`                  | `'name' [, kwargs]`                                                                         |
| `layout`                 | `expression`                                                                                |
| `capture`                | `variableLookup`                                                                            |
| `increment`, `decrement` | `variableLookup`                                                                            |
| `partial`                | `'name'`                                                                                    |
| `ifchanged`              | (empty string)                                                                              |
| `liquid`                 | newline-separated statements                                                                |

### HTML

```
htmlNode     := htmlElement | htmlVoid | htmlSelfClosing | htmlRawNode
              | htmlDoctype | htmlComment | htmlDanglingMarkerClose

htmlElement  := '<' tagName attributes '>' children '</' tagName '>'
htmlVoid     := '<' voidTagName attributes '>'
htmlSelfClosing := '<' tagName attributes '/>'
htmlRawNode  := '<' rawTagName attributes '>' rawBody '</' rawTagName '>'
htmlDoctype  := '<!doctype' ... '>'
htmlComment  := '<!--' (text | liquidNode)* ('-->' | '--!>') | '<!-->' | '<!--->'
```

**HTML comments hold Liquid.** Liquid renders the Liquid inside `<!-- -->`, so a comment's body is parsed into `children` as text and Liquid, never markup. A comment that crosses a Liquid block boundary is split there: one `HtmlComment` ends before the tag that ends or branches the enclosing block, and the next starts after it, with an empty `blockEndPosition` or `blockStartPosition` on the split side. When a block opened inside a comment holds the `-->`, the comment ends with that block. A comment that never closes ends at the end of the source, as in a browser. An end or branch tag inside a comment that matches no open block fails, as in Liquid. `opaqueHtmlComments` keeps comment bodies opaque, for HTML that is data rather than a template.

**Tag names can be compound** — they may contain Liquid variable outputs: `<{{ header_type }}--header>`.

**Void elements:** `area`, `base`, `br`, `col`, `command`, `embed`, `hr`, `img`, `input`, `keygen`, `link`, `meta`, `param`, `source`, `track`, `wbr` (case-insensitive).

**HTML raw tags:** `script`, `style`, `svg` — body is `RawMarkup`, not parsed as HTML/Liquid.

**Attributes:**

- `name="value"` → `AttrDoubleQuoted`
- `name='value'` → `AttrSingleQuoted`
- `name=value` → `AttrUnquoted`
- `name` → `AttrEmpty`
- Attribute names and values can contain Liquid drops
- Liquid tags (`{% if %}...{% endif %}`) can appear between attributes

### `RawMarkup` and `RawMarkupKinds`

`RawMarkup` has three fields: `kind` (content language hint), `value` (raw string), and `nodes` (parsed content).

**`RawMarkup.nodes` — which raw tags parse Liquid inside their body:**

| Tag                | Parses Liquid into `nodes`?                   | `kind`                                     |
| ------------------ | --------------------------------------------- | ------------------------------------------ |
| `{% javascript %}` | YES — Liquid drops/tags in body become nodes  | `javascript`                               |
| `{% style %}`      | YES — Liquid drops/tags in body become nodes  | `css` (or `text` if Liquid tokens present) |
| `{% stylesheet %}` | YES — Liquid drops/tags in body become nodes  | `css` (or `text` if Liquid tokens present) |
| `{% schema %}`     | NO — body is TextNode only                    | `json`                                     |
| `{% raw %}`        | NO — body is TextNode only                    | `text`                                     |
| `{% comment %}`    | NO — body is TextNode only                    | `text`                                     |
| `{% doc %}`        | SPECIAL — body is parsed into LiquidDoc nodes | `text`                                     |
| `<script>`         | YES — Liquid drops/tags in body become nodes  | see `<script>` kind rules below            |
| `<style>`          | YES — Liquid drops/tags in body become nodes  | `css` (or `text` if Liquid tokens present) |
| `<svg>`            | YES — Liquid drops/tags in body become nodes  | `text`                                     |

Tags that parse Liquid produce `nodes` arrays containing interleaved `TextNode` and `LiquidNode` children. Tags that don't parse Liquid produce `nodes` arrays with `TextNode` only (the raw string as text).

**`<script>` kind inference from `type` attribute:**

- No `type` attribute → `javascript`
- `type="text/javascript"` or `type="module"` → `javascript`
- `type="application/json"` or `type="application/ld+json"` → `json`
- `type="text/markdown"` → `markdown`
- `type="text/typescript"` → `typescript`
- Other → `text`

**`{% style %}`/`{% stylesheet %}`/`<style>` kind toggle:** If the body contains Liquid tokens (`{{` or `{%`), `kind` becomes `text` instead of `css`. This is a hint for formatters — it does not affect whether Liquid is parsed into nodes.

### LiquidDoc (`{% doc %}...{% enddoc %}`)

The `doc` tag is raw but its body gets parsed into structured doc nodes:

```
docBody      := (descriptionContent | annotation)*
annotation   := '@param' paramDef | '@example' content | '@prompt' content | '@description' content
paramDef     := ['{' type '}'] ('[' name ']' | name) ['-' description]
```

- Implicit description: text before any `@` annotation becomes `LiquidDocDescriptionNode` with `isImplicit: true`
- `@param` `required` field: `true` if name is bare (`product`), `false` if wrapped in brackets (`[product]`)

---

## Parser Modes

### `mode: 'tolerant'` (default)

- Markup parse failures (tag markup doesn't match expected grammar) → fall back to `LiquidTagBaseCase` with raw markup string. No throw.
- When variable output parsing fails, fall back to `LiquidVariableOutput` with markup as string
- Structural errors (unclosed block tags, mismatched end tags, branch tags outside parent, close tags at top level) → always throw `LiquidHTMLASTParsingError`, even in tolerant mode

### `mode: 'strict'`

- No fallback to base cases
- Throws `LiquidHTMLASTParsingError` on any unparseable markup

### `mode: 'completion'`

- Like tolerant but also handles:
  - Incomplete/dangling nodes (unclosed tags, partial expressions)
  - The `█` placeholder character (U+2588) in tag names and variable lookups
  - Partial named arguments (e.g., `{% content_for 'type', arg█ %}`)
- Used by the LSP for autocomplete

### `toLiquidAST` vs `toLiquidHtmlAST`

`toLiquidHtmlAST` parses both HTML and Liquid into the AST. HTML tags become `HtmlElement`, `HtmlVoidElement`, `HtmlSelfClosingElement`, `HtmlRawNode`, etc.

`toLiquidAST` parses Liquid only. HTML is **not parsed** — `<div>`, `<script>`, `<style>` etc. are all treated as `TextNode`. Only Liquid tags and drops produce structured AST nodes.

### `allowUnclosedDocumentNode`

- `true` (default for `toLiquidAST`): Unclosed nodes are allowed — they become part of the tree without error.
- `false` (default for `toLiquidHtmlAST`): Unclosed HTML tags cause `LiquidHTMLASTParsingError` (unless inside conditional branches where dangling open/close tags are expected).

---

## Error Handling

The parser throws `LiquidHTMLASTParsingError` for:

- Unclosed Liquid block tags (in strict/tolerant)
- Unclosed HTML elements (only in `toLiquidHtmlAST` mode, not inside branches)
- Mismatched close tags (`{% if %}...{% endfor %}`)
- Opening branch tags outside a parent block (`{% elsif %}` without `{% if %}`)
- Close tags at top level (`{% endif %}` without `{% if %}`)

The error includes source position info (`loc: { start: {line, column}, end: {line, column} }`).

**Special case — unclosed nodes inside branches:**

```liquid
{% if condition %}
  <div>
{% else %}
  </div>
{% endif %}
```

This is VALID. The unclosed `<div>` in the if-branch and the dangling `</div>` in the else-branch are allowed. The `</div>` becomes an `HtmlDanglingMarkerClose` node.

---

## Constants

Defined in `src/grammar.ts`, exported via `index.ts`:

```typescript
const BLOCKS = [
  "if",
  "unless",
  "for",
  "case",
  "tablerow",
  "capture",
  "form",
  "paginate",
  "block",
  "ifchanged",
  "partial",
];
const RAW_TAGS = ["raw", "javascript", "schema", "stylesheet", "style", "comment", "doc"];
const VOID_ELEMENTS = [
  "area",
  "base",
  "br",
  "col",
  "command",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];
const TAGS_WITHOUT_MARKUP = [
  "style",
  "schema",
  "javascript",
  "else",
  "break",
  "continue",
  "comment",
  "raw",
  "doc",
];
```

---

## Test Infrastructure

### Oracle tests (`parser-oracle.test.ts`)

For each `.liquid` file in `fixtures/theme/{base-theme,dawn,horizon}/`:

1. Parse with `toLiquidHtmlAST(source)` and `toLiquidAST(source)`
2. Strip internal fields from AST via `JSON.stringify` replacer:
   - `source`, `_source` (full document strings)
   - `nonTraversableProperties` (`parentNode`, `prev`, `next`, `firstChild`, `lastChild`)
   - Legacy fields: `locStart`, `locEnd`, `conditions`, `renderArguments`, `sectionName`, `blockName`, `blockStartLocStart`, `blockStartLocEnd`, `blockEndLocStart`, `blockEndLocEnd`, `attrList`
3. Compare against golden JSON file with `expect(stripped).toEqual(golden)`

The golden files represent the ground truth AST output for each fixture. Fixtures are generated locally per `fixtures/README.md`.

### Parser specs (`specs/parser` at the repo root)

Language-neutral specs: each case is a template and the complete tree, or the error, that
`toLiquidHtmlAST` or `toLiquidAST` gives for it. `src/specs.test.ts` runs them, and
`specs/parser/README.md` describes the format. They cover:

- All expression types (strings, numbers, literals, ranges, lookups, comparisons, logical ops)
- All named tags (assign, echo, render, for, if, case, cycle, paginate, etc.)
- HTML elements, attributes, void elements, raw tags
- Error cases (unclosed nodes, mismatched tags, etc.)
- Branch position tracking
- Whitespace trim markers

### Unit tests

The other tests, like `ast.test.ts` and `document/*.test.ts`, cover what a spec can't state: the
tokenizers, the node factories, and parses with options, like completion mode.

---

## Build

- **Framework:** Vite + vite-plugin-dts
- **Test runner:** Vitest 3.x
- **Module system:** ESM (`"type": "module"`)
- **Dependencies:** `line-column` (for error position reporting)
- **TypeScript:** 5.7

### Running tests

```bash
cd packages/liquid-html-parser
pnpm vitest run src/parser-oracle.test.ts    # oracle golden tests
pnpm vitest run src/specs.test.ts            # parser specs
pnpm vitest run                              # all tests
```
