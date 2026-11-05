---
'@shopify/liquid-html-parser': patch
---

Parse names inherited from `Object.prototype` like any other name. `{{ constructor }}` and `{{ toString }}` were parsed as Liquid literals whose value was a JavaScript function, and `{% constructor %}` or `{% __proto__ %}` made the parser throw instead of producing an unknown tag. Recognizing literal keywords with a `switch` is also slightly faster.
