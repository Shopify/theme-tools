---
'@shopify/theme-language-server-common': minor
'theme-check-vscode': minor
---

Add Liquid tag snippet completion

- Accept the completion item for `if` and get `{% if ${1:condition} %}\n  $0\n{% endif %}` with tabulated placeholders
  - `${1:condition}` is the first placeholder, press tab to reach the next one
  - `$0` is the last one
- This kind of completion works for every Liquid tag and is powered by the syntax snippets on https://shopify.dev
- The snippets are smart depending on context:
    - Will infer whitespace stripping characters based on context
    - Will not snippet complete `{%` and `%}` if inside a `{% liquid %}` tag
    - Will not snippet complete if markup is already present in the tag definition
