# liquid-parser

A parser for Liquid HTML templates, the Liquid and HTML of Shopify themes, in Rust. It's a port of
[`@shopify/liquid-html-parser`](https://github.com/Shopify/theme-tools/tree/main/packages/liquid-html-parser):
both run the parser specs in
[`specs/parser`](https://github.com/Shopify/theme-tools/tree/main/specs/parser), so they build the
same trees and fail with the same errors.

```rust
let doc = liquid_parser::parse("{% if product %}<p>{{ product.title }}</p>{% endif %}")?;
assert_eq!(doc.children.len(), 1);
```

`parse` parses the Liquid and the HTML. `parse_liquid` parses the Liquid only: the HTML stays
text, and blocks may be left unclosed. The tree is
[`liquid-ast`](https://crates.io/crates/liquid-ast)'s, and its spans are byte offsets in the
source. A template nested more than 1,000 levels deep fails to parse.
