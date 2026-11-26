# Parser specs

Executable, language-neutral specs for the Liquid HTML parser: the tree it builds for a template,
or the error it throws. Every implementation runs them. In TypeScript that's
`packages/liquid-html-parser/src/specs.test.ts`, which runs with the rest of the vitest suite, and
in Rust `crates/liquid-parser/tests/specs.rs`, which `cargo test` runs. To change what the parser
does, change its spec first.

## Format

```yaml
cases:
  - name: parses a drop
    source: "{{ x }}" # the template
    parse: [html, liquid] # the parses that give this tree
    ast: # the whole tree
      type: Document
      name: "#document"
      position: { start: [0, 0], text: "{{ x }}" }
      children:
        - type: LiquidVariableOutput
          whitespaceStart: ""
          whitespaceEnd: ""
          markupPosition: { start: [0, 2], text: " x " }
          position: { start: [0, 0], text: "{{ x }}" }
          markup:
            type: LiquidVariable
            rawSource: x
            position: { start: [0, 3], text: "x " }
            expression:
              type: VariableLookup
              name: x
              position: { start: [0, 3], text: x }
              lookups: []
              lookupModes: []
            filters: []
```

`parse` lists the parses the case is for. Both use their default options:

| `parse`  | What it parses            | TypeScript        | Rust                 |
| -------- | ------------------------- | ----------------- | -------------------- |
| `html`   | Liquid and HTML           | `toLiquidHtmlAST` | `to_liquid_html_ast` |
| `liquid` | Liquid, with HTML as text | `toLiquidAST`     | `to_liquid_ast`      |

When the two give different results for a template, they're two cases.

`ast` is every node, with every property, as TypeScript's parser builds them. A case fails on a
missing, extra or different property. The order of properties doesn't matter, and the order of
lists does. Left out are:

- `source` and `_source`, which are the template on every node. The TypeScript runner checks
  that they are.
- The links between nodes: `parentNode`, `prev`, `next`, `firstChild` and `lastChild`. The parser
  doesn't set them.
- Properties that are `undefined`. A `null` stays.

A position is where its range starts and the text it covers. `start` is a line and character,
0-based, in UTF-16 code units. `text` is cut out of the template at the range, never searched
for, so `start` and `text` pin the range even when the text repeats.

## Errors

A case whose parse throws has `error` instead of `ast`:

```yaml
cases:
  - name: closes a tag before its element
    source: "{% for a in b %}<details>{% endfor %}"
    parse: [html]
    error:
      message: Attempting to close LiquidTag 'endfor' before HtmlElement 'details' was closed
      start: [0, 16]
      text: <details>
```

The parse throws a parse error, `LiquidHTMLASTParsingError` in TypeScript and `ParseError` in
Rust, with that `message`. `start` and `text` are its location (`loc`), as for positions.

A location never goes past the template's last character, so an error at its end covers one
character less than the tag: an unclosed `{% if a %}` covers `{% if a %`.

An error about a node that was never closed also has `unclosed`: the node's `type`, its `name` as
written in the template, and the position of its opening tag. An editor uses it to insert the
missing close tag. The node can differ from the error's location:

```yaml
source: <a><div></a>
error:
  message: Attempting to close HtmlElement 'a' before HtmlElement 'div' was closed
  start: [0, 8]
  text: </a
  unclosed:
    type: HtmlElement
    name: div
    blockStartPosition: { start: [0, 3], text: <div> }
```

Other errors have no `unclosed`.

## Writing a case

Write its `name`, `source` and `parse`, and have TypeScript fill in the result:

```sh
UPDATE_SPECS=1 npx vitest run packages/liquid-html-parser/src/specs.test.ts
```

It writes every case's `ast` or `error` from the TypeScript parser, and fails on a case whose
parses give different results, which needs splitting. Read the diff before committing it: it's
what every implementation will be held to.
