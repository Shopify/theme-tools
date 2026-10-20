# AGENTS.md

Theme Check has two implementations, TypeScript in `packages/` and Rust in `crates/`. Both run
the specs in `specs/`.

To add a check, or to change what a check or the parser reports, add or change its spec case
first. Then make the TypeScript and the Rust pass it. A refactor that doesn't change what's
reported needs neither.

- `pnpm test` runs the TypeScript tests and specs.
- `cargo test --workspace` runs the Rust ones.

The Rust crate keeps copies of `packages/theme-check-node/configs` and of the checks' meta in
`crates/theme-check/src/node`. A new check, or a change to a check's meta or to the configs,
needs them updated. CI diffs them.
