---
'@shopify/theme-check-node': patch
---

Improve YAML parsing error messages caused by YAML aliases

```yaml
ignore:
  # this causes an error because * at the start of a statement in YAML
  # is used for aliases to anchors such as `&.code-workspaces`
  - *.code-workspaces

  # what you want is this
  - '*.code-worksapces'
```

It’s a pretty obscure error for the non-initiated, so now we’ll
instead throw an error like this:

```
YAML parsing error: Unresolved alias *.code-workspaces
Did you forget to wrap it in quotes? '*.code-workspaces'
```
