---
'theme-check-rs': patch
---

`liquid-parser` parses block tags glued to an HTML tag name (`<a{% if x %}{% endif %}…>`) in time linear in the length of the name. Before, each glued block with an empty body looked ahead to the end of the HTML tag again, so the parse time grew with the square of the number of such blocks. The parsed trees are unchanged.
