---
'@shopify/liquid-html-parser': patch
---

Parse a run of blank lines in a `{% doc %}` body in one pass when text follows it. Before, the parser looked ahead to the end of the run again from each newline in the run, so the parse time grew with the square of the number of blank lines. The parsed nodes are unchanged.
