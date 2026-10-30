---
'@shopify/liquid-html-parser': patch
---

Tokenize HTML comments as a browser does. In a comment only Liquid and the comment's close count, so a `<b`, an unbalanced quote or a nested `<!--` can no longer hide the `-->`. A comment closes on `-->` or `--!>`, and `<!-->` and `<!--->` are empty comments. Outside a comment, `-->` is text. The bodies of Liquid raw tags like `{% comment %}` are opaque to the tokenizer too, so a `<!--` or a quote in one no longer affects the rest of the file.
