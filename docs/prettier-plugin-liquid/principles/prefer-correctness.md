[Principle](./index.md): **Prefer correctness over beautiful, unless opted-in.**

That is, by default, prettier should not alter the *semantic meaning* of a file.

Examples:
- Whitespace handling in HTML
- Whitespace handling in Liquid

## Whitespace handling in HTML

Whitespace in HTML is meaningful (or not) depending on the context. There's a [2000 word article on MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace) that goes into the details of how it works.

As a result, pretty printing HTML that respects semantic meaning is counter-intuitive. For instance, you might expect the following:

```html
before prettier
<span>I'm em<em>bold</em>ened by these changes!</span>

after prettier (expected/incorrect)
printWidth: -----|
<span>
    I'm em
    <em>bold</em>
    ened by these
    changes!
</span>
```

But it's **incorrect**, because the lack of whitespace between `em<em>bold</em>en` is meaningful. It wouldn't be if we used a `div`, but it is for nodes that create [inline formatting contexts](https://developer.mozilla.org/en-US/docs/Web/CSS/Inline_formatting_context).

The first outputs
- <span>I'm em<em>bold</em>ened by these changes!</span>

The second outputs outputs
- <span>
    I'm em
    <em>bold</em>
    ened by these changes!
</span>

The **correct** solution *maintains* the lack of whitespace. For HTML nodes, the only solution available is to borrow the opening or closing tag markers of the surrounding nodes. Like this:

```html
before prettier
<span>I'm em<em>bold</em>ened by these changes!</span>

after prettier (correct)
printWidth: ----|
<span
  >I'm em<em
    >bold</em
  >ened by these
  changes!</span
>
```

Which looks funny because the printWidth is so small, but it outputs correctly (you can view source to verify):
<ul><li>
<span
  >I'm em<em
    >bold</em
  >ened by these
  changes!</span
>
</li></ul>

For a more in-depth discussion about how we handle this, see [Whitespace Handling](../whitespace-handling.md)
