---
'@shopify/theme-graph': patch
---

Build the theme graph for themes with contextual templates and section groups (`*.context.<name>.json`). Their sections and blocks that inherit a `type` from the parent no longer stop the graph, which made `OrphanedSnippet` report every snippet. The blocks they add are linked, an override without `sections` is accepted, a contextual template uses its parent's layout, and contextual section groups are entry points.
