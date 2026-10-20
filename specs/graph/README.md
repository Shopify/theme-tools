# Graph specs

Executable, language-neutral specs for the theme graph: which files depend on which. Every
implementation runs them. In TypeScript that's `packages/theme-graph/src/specs.spec.ts`, which
runs with the rest of the vitest suite. To change what the graph does, change its spec first.

## Format

```yaml
cases:
  - name: follows a render
    mode: app # optional: theme or app. Without it, theme.
    files: # the theme, by path from its root
      sections/main.liquid: |
        {% render 'card' %}
      snippets/card.liquid: |
        Card
    entryPoints: [sections/main.liquid] # optional: every entry point
    modules: # optional: every module
      - { file: sections/main.liquid, type: Liquid, kind: section }
      - { file: snippets/card.liquid, type: Liquid, kind: snippet }
    edges: # every edge. Without it, none.
      - source: sections/main.liquid
        start: [0, 0] # line and character
        text: "{% render 'card' %}" # from start to the edge's end
        target: snippets/card.liquid
```

An edge goes from the file that depends to the file it depends on. `start` is where in the source
it happens: line and character, 0-based, in UTF-16 code units. `text` is what the edge covers.
It's cut out of the file at the range the graph reported, never searched for, so `start` and
`text` pin the range even when the text repeats. An edge that comes from no particular place, like
a template's layout, has neither. `type` is `direct` (the default), `indirect` or `preset`.

An edge to a custom element's definition also has `targetStart` and `targetText`, where the
script defines it:

```yaml
edges:
  - source: sections/main.liquid
    start: [0, 0]
    text: "<price-tag"
    target: assets/theme.js
    targetStart: [0, 15]
    targetText: "define('price-tag'"
```

A module's `type` and `kind` follow from its path. A module that's referenced but not in `files`
has `exists: false`. Most cases leave out `entryPoints` and `modules`, since both follow from the
paths, and only the cases about them state them.

Edges, entry points and modules are compared as unordered lists. A case fails on a missing, extra
or different one, and when building the graph throws.

## The run

Each case builds the graph of its `files`, in its `mode`. Every dependency is derived from
`files`:

- `fs` serves `files`.
- Block and section schemas come from the `{% schema %}` of `blocks/*.liquid` and
  `sections/*.liquid`. They're assumed valid.
- Custom element definitions come from the `customElements.define` calls in `assets/*.js`, as in
  the language server.
