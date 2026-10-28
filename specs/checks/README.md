# Check specs

Executable, language-neutral specs for theme-check checks: one `<check>.toml` per check. Every
implementation runs them. In TypeScript that's `packages/theme-check-common/src/specs.spec.ts`,
which runs with the rest of the vitest suite and fails if a check has no spec. To change what a
check does, change its spec first.

## Format

```toml
check = "UnusedAssign" # the check's code
severity = "warning" # its default severity

[[cases]]
name = "reports a variable that is assigned but not used"
docset = "default" # optional: docsets/default.toml. Without it, the run has no theme docset.
mode = "app" # optional: theme or app. Without it, theme.
checks = ["UnusedAssign", "UndefinedObject"] # optional: run these instead of the spec's check

[cases.files] # the theme, by path from its root
"snippets/example.liquid" = '''
{% assign unused = 1 %}
'''

[[cases.offenses]] # every offense the check reports. Without it, none.
check = "UnusedAssign" # the check that reported it, only when the case lists checks
file = "snippets/example.liquid" # the file the offense is in
message = "The variable 'unused' is assigned but not used"
start = [0, 0] # line and character, 0-based, in UTF-16 code units
highlight = "{% assign unused = 1 %}" # the text from start to the offense's end
# fix = "..." # optional: the file after the fix

[[cases.offenses.suggest]] # each suggestion, when the offense has any
message = "Remove the unused variable 'unused'"
result = "\n" # the file after applying it
```

Each `[[cases]]` starts a case. Its tables, such as `[cases.files]` and `[[cases.offenses]]`,
belong to that case until the next `[[cases]]`. Put case properties like `docset`, `mode` and
`checks` before its tables. Quote file paths and URLs so dots aren't interpreted as nested keys.

Multiline literal strings (`'''`) preserve quotes, backslashes and whitespace. The newline
immediately after the opening delimiter is trimmed; a newline before the closing delimiter is
part of the content. To omit a trailing newline, put the closing delimiter at the end of the
last content line. Use basic strings (`"..."`) for escapes such as `\n` or `\r\n`.

The docset is the Shopify reference data checks look things up in: `filters`, `objects`, `tags`
and `systemTranslations`. A case names a file in `docsets/`, or writes one out in the same shape:

```toml
[cases.docset]
tags = [{ name = "custom_tag" }]
```

`config` holds check options by check code, as in `.theme-check.yml`:

```toml
[cases.config.LiquidComplexity]
maxComplexity = 5
```

`references` lists which files render which: what production gets from the theme graph. `type`
is `direct` (a `{% render %}`, the default), `indirect` or `preset`:

```toml
[[cases.references]]
source = "sections/section.liquid"
target = "snippets/child.liquid"
```

A file at an `http://` or `https://` URL is a remote file, like a script on a CDN. It isn't part
of the theme: checks only see its size.

```toml
[cases.files]
"templates/index.liquid" = '<script src="https://cdn.example.com/app.js" defer></script>'
"https://cdn.example.com/app.js" = "console.log('hello world');"
```

A spec for a feature rather than a check, like `disabled-checks.toml`, has no `check` or
`severity`, and each of its cases lists its `checks`.

A file too large to write out can be a list of parts, joined in order. A part is a string or
`{ repeat = "<string>", times = <count> }`:

```toml
[cases.files]
"config/markets.json" = ['{"d":"', { repeat = "a", times = 262137 }, '"}'] # 262,145 bytes
```

So can a highlight that's too large to write out:

```toml
[[cases.offenses]]
file = "config/markets.json"
message = "Theme file is too large. It is 262145 bytes but the limit is 256 KB."
start = [0, 0]
highlight = ['{"d":"', { repeat = "a", times = 262137 }, '"}']
```

A case states `autofix` for exactly the files with two or more fixes: each file after applying all
its fixes at once. Fixes that can't be applied together fail the case.

```toml
[cases.autofix]
"file.liquid" = "{{ 'hello' | upcase | downcase | reverse }}"
```

An offense's `highlight` is cut out of the file at the range the check reported, never searched
for, so `start` and `highlight` pin the range even when the text repeats.

Offenses are compared as an unordered list. A case fails on a missing, extra or different
offense, and when the check throws. What it doesn't state must be right too: each offense's
severity is its check's, and its start and end are in order, in the file, at the line and
character of their index.

## The run

Each case runs only its spec's check, or its `checks`, in its `mode`, with its `config` and
defaults for the rest. An option or check that doesn't exist is an error, since it would otherwise
be ignored. Every dependency is either declared in the case or derived from `files`:

- `fs` serves `files` plus an empty `.theme-check.yml`.
- Block and section schemas come from the `{% schema %}` of `blocks/*.liquid` and
  `sections/*.liquid`. They're assumed valid.
- Doc definitions come from the `{% doc %}` of the file at that path.
- CSS classes come from the files.
- `getReferences` and `getDependencies` answer from `references`: the edges into the file, and
  out of it. Both ends of an edge must be in `files`.
- A remote file's size is its length in UTF-8 bytes. Any other URL has size 0, as when the request
  fails, so nothing reaches the network.
- A `docset` gets the same augmentations as in production (`AugmentedThemeDocset`).
