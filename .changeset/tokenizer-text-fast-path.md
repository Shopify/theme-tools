---
'@shopify/liquid-html-parser': patch
---

Tokenize runs of plain text in one step instead of one character at a time. Most characters can't start a token, so the tokenizer now jumps to the next one that can.

Tokens and ASTs are unchanged. On Dawn, Horizon and the base theme, `tokenize` is about 6× faster and `toLiquidHtmlAST`/`toLiquidAST` about 2× faster.
