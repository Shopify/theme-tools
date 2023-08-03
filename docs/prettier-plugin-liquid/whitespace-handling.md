## The problem

[Whitespace in HTML](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace) is a complex topic. Depending on the context, whitespace may be meaningful or not.

When we're writing a prettier plugin—since one of our [principles](principles/index.md) is to [prefer correctness over beautiful, unless opted-in](principles/prefer-correctness.md)—it is important to maintain the semantic meaning of the source file when we're reformating the file.

Failure to do so results in broken themes and unhappy developers.

Unfortunately, it's hard to wrap your head around the entire problem, let alone the entire solution. This doc exists to give you an overview of the problem space before you look at the code and try to piece it out for yourself.

In general, we have two concern:
- Maintaining the lack of whitespace when it is meaningful
- Removing whitespace when it isn't meaningful

## Definitions

**Whitespace** is a literal space character, tab character or newline character (`\n` or `\r\n`)

A node is **leading whitespace sensitive** when adding whitespace *before* the node changes the semantic meaning. For instance, in `<p>hello<em>world</em></p>`, the `em` tag is leading whitespace sensitive since adding whitespace before changes the output:
- before: hello<em>world</em>
- after: hello <em>world</em>

A node is **trailing whitespace sensitive** when adding whitespace *after* the node changes the semantic meaning. For instance, in `<p><em>hello</em>world</p>`, the `em` tag is trailing whitespace sensitive since adding whitespace after changes the output:
- before: <em>hello</em>world
- after: <em>hello</em> world

Whitespace (or the lack of thereof) between nodes is **meaningful** when either of the following is true:
- the previous node is trailing whitespace sensitive
- the next node is leading whitespace sensitive.

A **node** is one of the many AST (Abstract Syntax Tree) nodes that we got from parsing the Liquid template.

## The tools

There are two categories of tools to deal with whitespace or the lack of whitespace.
- HTML tools
- Liquid tools

### Maintaining lack of whitespace in HTML

For **HTML**, the only solution is to "borrow" the sibling (or parent) node's tag delimiters:

```html
<!-- before -->
<p><em>hello</em>world</p>

<!-- after -->
<p>
  <em>hello</em
  >world
</p>
```

What we see here is that the `TextNode` with value of `world` _borrowed_ the `em` tag's closing tag end's marker.

### Maintaining lack of whitespace in Liquid

For **Liquid**, we can optionally add whitespace stripping characters to the node:

```html
<!-- before -->
<p><em>hello</em>{% echo 'world' %}</p>

<!-- after -->
<p>
  <em>hello</em>
  {%- echo 'world' %}
</p>
```

What we see here is that `{% echo 'world' %}` Liquid tag added the whitespace stripping character `-` to the left to maintain the lack of whitespace.

## The solution

Recalling our two concerns:
- Maintaining the lack of whitespace when it is meaningful
- Removing whitespace when it isn't meaningful

To maintain the lack of whitespace in HTML, we have a rule:

> When the lack of whitespace around an HTML node is meaningful, maintain it with tag marker borrowing.

To maintain the lack of whitespace in Liquid, we have this rule:

> When the lack of whitespace around a Liquid node is meaningful, maintain it with whitespace stripping.

When the two rules above are in conflict, we have another rule:

> Prefer whitespace stripping over tag marker borrowing.

Removing whitespace when it isn't meaningful only requires us to not include it in the output.

## Concretely, where to go from here?

If you're wondering how we determine if a node **is whitespace sensitive**, see [augment-with-whitespace-helpers.ts](../src/printer/preprocess/augment-with-whitespace-helpers.ts).

If you're wondering how we do **tag marker borrowing**, see [print/tag.ts](../src/printer/print/tag.ts).

If you're wondering how we do **conditional whitespace stripping**, see [print/liquid.ts](../src/printer/print/liquid.ts).

If you're wondering **what kind of whitespace we use between nodes**, see [print/children.ts](../src/printer/print/children.ts).
