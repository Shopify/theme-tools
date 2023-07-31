## Liquid-in-JS

**We do not plan to offer complete support for Liquid in JS.**

That said, we do offer _partial_ support for it. We support Liquid inside JavaScript strings:

```liquid
{% # 👍 supported, will be reformatted using prettier's own JavaScript formatter %}
<script>
  const mySetting = '{{ some_liquid_drop }}';
</script>

{% # 👎 not supported, will only reindent the code %}
<script>
  {% if condition %}
    {% # do stuff %}
  {% endif %}
</script>
```

If you want to refer to a JSON blob, you can do this "purely" by using a `<script type="application/json">` with a Liquid JSON dump in it:

```liquid
{% # dump your JSON in an application/json script tag %}
<script id="my-settings" type="application/json">
  {{ my_settings | json }}
</script>

{% # use your JSON by reading it with JavaScript %}
<script> 
  const myLiquidSettings = JSON.parse(
    document.getElementById('my-settings').textContent
  );
</script>
```

## Liquid-in-CSS

**We do not plan to offer complete support for Liquid in CSS (or any support for `.css.liquid`)**

Our recommendation is the following:
- Define [CSS Custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*) somewhere in your HTML-Liquid files.
- Use plain `.css` files that refer to those custom CSS properties

Example:

`theme.liquid`
```liquid
<style>
  :root {
    --accent-colour: {{ some_setting }};
  }
</style>
```

`styles.css`
```css
button.accent {
  color: var(--accent-colour);
}
```

You can see this pattern used in the Dawn repo. 
- [theme.liquid](https://github.com/Shopify/dawn/blob/main/layout/theme.liquid#L48-L184)
- [base.css](https://github.com/Shopify/dawn/blob/main/assets/base.css#L3-L14)

Pros of this approach:
- Your CSS files are then true CSS files. This means you can use the official syntax highlighting for CSS, the formatter for CSS, etc. Which are bound to have better support than this plugin can offer. 
- You can use build tools independently of Liquid that work with CSS files.
- You could even use LESS or SCSS independently if you are so inclined.
