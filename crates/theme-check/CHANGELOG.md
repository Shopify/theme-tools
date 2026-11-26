# theme-check-rs

## 0.2.0

### Minor Changes

- 537c7059: Infer `article_list` theme settings as arrays of articles, as `@shopify/theme-check-common` does
- 31551e4e: `MatchingTranslations` now reports pluralized entries in the storefront default locale that are missing `other`, as the TypeScript check does.
- c374706b: Report optional LiquidDoc parameters that are used in a snippet but never passed by its callers.
- dc25d305: Add the `ValidSelectDefault` check, which warns when a `select` or `radio` setting's default, or a value that a preset or section default gives it, is not one of the setting's options.
- f3d24bf8: `ValidSettingsKey` now reports section and block setting keys in JSON templates that the section or block schema doesn't define, as the TypeScript check does.
- 66e654a9: Add the `ValidRangeDefault` and `ValidRangeStepCount` checks for `range` settings. The storefront rejects both problems with an "Invalid schema" error that breaks `shopify theme dev` and the theme editor, though `shopify theme push` accepts them.
  - `ValidRangeDefault` reports a `default`, preset value or section `default.settings` value that is outside `[min, max]` or off the `step` grid, such as `{ "type": "range", "min": 0, "max": 160, "step": 8, "default": 60 }`.
  - `ValidRangeStepCount` reports a range setting with more than 101 steps, such as `{ "type": "range", "min": 0, "max": 200, "step": 1 }`.

  Both checks read the range settings of sections, theme blocks, local blocks and `config/settings_schema.json`. A setting without `step` has a step of 1.

### Patch Changes

- 78bbce68: Stop crashing on blocks named by a plain string in a section's presets or `default`, and accept `@app` in the `default` of a section with local blocks
- 5740888d: Accept fixed-value settings on canonical inline app block tags.

  `LiquidSyntaxError` allows plain setting arguments whose values are strings, numbers, booleans or flat arrays of those. Dynamic sources remain supported as strings such as `'{{ closest.product.title }}'`. Expressions, `nil`/`null`, `empty`/`blank`, namespaced setting arguments and body content remain invalid. Theme block arguments are unchanged.

- 4aaa426d: Stop `LiquidHTMLSyntaxError` from splitting loop lookups with spaces in quoted keys, such as `product.options_by_name['hello world']`, and from deleting part of them in its fix.
- 3155a2d1: Missing render snippet arguments now recognizes the implicit variable provided by `with` and `for` when no `as` alias is specified.
- cf24f8d3: AssetSizeCSS and AssetSizeJavaScript give curl every public address of a remote asset's host name, so it connects to whichever answers, as it does for a name it resolves. They no longer give size 0 when only the first address is unreachable.
- cf24f8d3: `AssetSizeCSS` and `AssetSizeJavaScript` read the size of a remote file only at a public address. They send no request to a URL that is not http(s), that has a user name or password, or whose host is `localhost` or an IP address that is not public (loopback, private, link-local, carrier-grade NAT, unique local and other special-purpose ranges). They do not follow redirects: a redirect gives size 0. In theme-check-node and the Rust port, a host name that resolves to an address that is not public gets no request either, and the request goes to the address that was checked.
- 28669513: Report `CdnPreconnect` for every `href` on the `https://cdn.shopify.com` origin, including `href="https://cdn.shopify.com"` and `href="//cdn.shopify.com"` without a path, and stop reporting other hosts that only contain `cdn.shopify.com`, as the TypeScript check does.
- 0507e17e: Build the theme graph for themes with contextual templates and section groups (`*.context.<name>.json`), so `OrphanedSnippet` no longer reports every snippet in them
- 7d13d63f: Fix `theme-check-disable-next-line` not suppressing offenses when the following tag is nested inside a raw HTML tag (`<style>`, `<script>`, `<svg>`)
- bb74363d: Only report `HardcodedRoutes` when the route matches whole path segments, so `/cartography` is no longer flagged as `/cart`. A route followed by a format extension, such as `/cart.js` or `/cart/add.js`, is still reported.
- bbd618c8: Apply `ignore` patterns from `.theme-check.yml` when the theme root is inside a dot-directory, such as `.worktrees/` or `~/.cache/`, as in `@shopify/theme-check-common`.
- 4b173ff6: Stop `JSONMissingBlock` from throwing on a JSON template that isn't an object, such as a `templates/index.json` that contains `null`
- ede4d4fc: `liquid-parser` parses block tags glued to an HTML tag name (`<a{% if x %}{% endif %}…>`) in time linear in the length of the name. Before, each glued block with an empty body looked ahead to the end of the HTML tag again, so the parse time grew with the square of the number of such blocks. The parsed trees are unchanged.
- 1e0bf81e: Report cross-file LiquidDoc errors when the theme path has a space and when the config sets `root`, as theme-check-node now does
- 78bbce68: Validate section-local block types referenced by presets and `default` in `ValidBlockTarget`, as theme-check-node now does
- 7bdc9e28: Match `ignore` patterns and `ignoreMissing` like `@shopify/theme-check-common`, which uses minimatch 11. Extglobs and classes don't match an empty path portion (`a/*(x)` matched `a/`), or a leading dot in `ignoreMissing` (`[.]*` matched `.a`). `?` and classes match a whole emoji, `[[:punct:]]` also matches symbols, `[[:print:]]` matches printable characters instead of control characters, `\|` in an extglob is a literal `|`, and a numeric range without a step, such as `{1..200000}`, matches all of its values. Matching takes polynomial time, so a pattern like `a*a*a*a*a*a*a*a*a*a*a*b` no longer takes seconds on a long file name.
- 33b1f3aa: `liquid-parser`'s `ParseError` names the node that was never closed in `unclosed`, as the TypeScript parser does.
- 9a0377db: Stop `TranslationKeyExists` from reporting `sections.<section-name>.<key>` translations that are defined in the section's own schema `locales`, as the TypeScript check does.
- df89377a: Carry the new `docs.url` links of `LiquidComplexity`, `LiquidNestingDepth`, `LiquidSyntaxError`, `ExcessiveSettingsCount`, `MaxFileSize`, `MaxFileSizeJSON`, `UniqueSettingId` and the six raw-tag checks in the check metadata the crate returns to Node.
- db3d76c6: Link `asset_url` references to the file Shopify serves them from, so `.css.liquid`, `.js.liquid` and `.scss.liquid` assets are no longer reported as dead code
- c4299f16: Build the theme graph when `templates/` has a file that isn't a `.json` or `.liquid` template, such as `.DS_Store` or `customers/.keep`, so `OrphanedSnippet` no longer reports every snippet
- 7eea77c5: Recognize contextual objects in `UndefinedObject` snippets based on the files that render them, as in `@shopify/theme-check-common`.
- 9f110b3f: Stop `UndefinedObject` from reporting `continue` in `{% for ... offset: continue %}`, as in `@shopify/theme-check-common`.
- 4b173ff6: Stop `ValidSettingsKey` from throwing on a JSON template that isn't an object, such as a `templates/index.json` that contains `null`
- 911a4513: Parse the body of a `style` tag inside `{% liquid %}` as Liquid statements. Before, it was one text node, so checks such as `UnusedAssign` missed the variables used there.
- f8e75c0b: Checks that look up a theme file by a name from theme content (`MissingAsset`, `ValidStaticBlockType`, `JSONMissingSection`, `MissingTemplate`, `JSONMissingBlock`, `ValidBlockTarget`, `AssetSizeJavaScript` and `AssetSizeCSS`) look only in the directory the path names, such as `assets`, `blocks` or `sections`. A name that leaves that directory, also in its percent-encoded form, now gets the same result whether or not a file exists at that path, and the check does not read the file system for it.

## 0.1.2

### Patch Changes

- 41f11363: Keep app block asset size checks inside the assets directory, matching TypeScript. Reject paths and encoded paths before checking whether a file exists or reading its size.

## 0.1.1

### Patch Changes

- 5c726064: Add `Checker::cancelable`, for a run that stops between files, and `Error::is_cancelled`
- 4a04763c: Add `Checker::ignore`, the files a run leaves out, as in `.theme-check.yml`'s `ignore`
- d1d509d5: Add `Checker::threads`, where 1 checks the files on the calling thread, and resume a check's panic with its own message
