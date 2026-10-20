# theme-check

Theme Check, the linter for Shopify themes, in Rust. It's a port of
[`@shopify/theme-check-node`](https://github.com/Shopify/theme-tools/tree/main/packages/theme-check-node)
and the packages it uses: the checks, their config, the theme graph and the Liquid HTML parser.
It reports the same offenses, with the same messages, positions and fixes.

Both implementations run the same [executable specs](https://github.com/Shopify/theme-tools/tree/main/specs):
every check spec in `specs/checks`, every graph spec in `specs/graph` and every parser spec in
`specs/parser`.

## Crates

- `liquid-ast`: the syntax tree, as `@shopify/liquid-html-parser` builds it.
- `liquid-parser`: the parser.
- `theme-check`: the checks, the runner, config loading, the theme graph and the CLI.

They're released together, with the same version.

## The CLI

```sh
cargo install theme-check
theme-check <root> [configPath]
theme-check <root> [configPath] --autofix
```

Like theme-check-node's `cli.ts`, it prints the offenses, the config and the theme's files as
JSON on stdout. `--autofix` fixes the files instead, and prints nothing.

## Development

```sh
cargo test
```

It runs the unit tests and the specs. To change what a check or the parser does, change its spec
first, then the TypeScript and the Rust.

Ported code keeps the TypeScript's behavior, quirks included, with a few rules:

- AST positions are UTF-8 byte offsets. Offenses and the theme graph report UTF-16 positions, as
  TypeScript does.
- JS semantics that offenses depend on are in `js.rs`: truthiness, `key in v`, `Object.entries`
  and string conversion. JSON objects keep their key order (`preserve_order`), and
  `json::js_insert` puts integer-like keys first, as JS does.
- A `Map` or `Set` whose iteration order matters is a `Vec` with a `HashMap` or `HashSet`.
- Where TypeScript throws, a check returns `Err(CheckError)`. The runner stops that check on that
  file, as TypeScript's `onError` does.
- A simplification with a known limit is marked with a `ponytail:` comment.

Release versions come from changesets. Add a changeset for `theme-check-rs`, the private
package in `crates/theme-check/package.json`, and the release sets that version in `Cargo.toml`.
