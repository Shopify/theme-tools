# Fixtures

Golden fixtures and theme files are gitignored (too large for PR diffs).

## Directory layout

- `theme/` -- raw `.liquid` files organized by theme (e.g. `theme/dawn/`, `theme/horizon/`)
- `theme-bundle.ts` -- auto-generated TypeScript module exporting all theme sources as an array
- `golden-html-ast/` -- JSON snapshots from `toLiquidHtmlAST` per theme
- `golden-liquid-ast/` -- JSON snapshots from `toLiquidAST` per theme

## Scripts

All scripts live in `../scripts/` and are run with `pnpx tsx`.

### Quick setup (all-in-one)

```
pnpx tsx scripts/setup-fixtures.ts
```

Downloads themes, generates the theme bundle, builds the parser, and generates golden fixtures. Idempotent — safe to re-run.

### 1. Download theme files

```
pnpx tsx scripts/download-themes.ts
```

Downloads Dawn (`Shopify/dawn`), Horizon (`Shopify/horizon`), and base-theme (`shopify-playground/ose-next-theme`) from GitHub using `gh api`. Extracts `.liquid` files into `fixtures/theme/<theme-name>/`. Requires `gh` CLI authenticated with repo access.

### 2. Generate theme bundle

```
pnpx tsx scripts/generate-theme-bundle.ts
```

Reads every `.liquid` file under `fixtures/theme/`, sorts them, and writes `fixtures/theme-bundle.ts` -- a TypeScript module that exports `THEME_FILES` (an array of `{ path, source }` objects). This lets tests import theme sources without filesystem access.

Requires `fixtures/theme/` to exist and contain at least one `.liquid` file.

### 3. Generate golden AST fixtures

```
pnpx tsx scripts/generate-golden.ts [path-to-parser-dist]
```

Parses every `.liquid` file under `fixtures/theme/` with both `toLiquidHtmlAST` and `toLiquidAST`, strips non-essential properties (positions, linked-list pointers, source), and writes one JSON file per template into `fixtures/golden-html-ast/<theme>/` and `fixtures/golden-liquid-ast/<theme>/`.

The optional argument overrides the parser module path (defaults to `dist/index.js`). Build the parser first (`pnpm run build`) when using the default.

Prints a per-theme success/failure summary on completion.
