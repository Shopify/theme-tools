import { expect, describe, it, vi } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { Offense } from '../../types';
import { LiquidHTMLSyntaxError } from './index';

describe('Module: LiquidHTMLSyntaxError', () => {
  it('should report unclosed Liquid tags', async () => {
    const sourceCode = `
      {% capture some_variable %}
        Hello, world!
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to end parsing before LiquidTag 'capture' was closed`,
    );
  });

  it('should report unclosed HTML tags', async () => {
    const sourceCode = `
      <a href="abc">
        Hello, world!
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to end parsing before HtmlElement 'a' was closed`,
    );
  });

  it('should report closing the wrong node (html/html)', async () => {
    const sourceCode = `
      <a href="abc">
        Hello, world!
      </b>
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to close HtmlElement 'b' before HtmlElement 'a' was closed`,
    );
  });

  it('should report closing the wrong node (html/liquid)', async () => {
    const sourceCode = `
      <a href="abc">
        Hello, world!
      {% endif %}
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `Attempting to close LiquidTag 'if' before HtmlElement 'a' was closed`,
    );
  });

  it('should report unexpected tokens (1)', async () => {
    const sourceCode = `
      {% if cond }}
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(`SyntaxError: expected "%}"`);
  });

  it('should report unexpected tokens (2)', async () => {
    const sourceCode = `
      <a href="abc" "></a>
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(`SyntaxError: expected ">", not """`);
  });

  it('should report unexpected tokens (3)', async () => {
    const sourceCode = `
      <a href="abc" {%></a>
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `SyntaxError: expected "#", a letter, "when", "sections", "section", "render", "liquid", "layout", "increment", "include", "elsif", "else", "echo", "decrement", "content_for", "cycle", "continue", "break", "assign", "tablerow", "unless", "if", "ifchanged", "for", "case", "capture", "paginate", "form", "end", "style", "stylesheet", "schema", "javascript", "raw", "comment", or "doc"`,
    );
  });

  it('should not report syntax error in valid Liquid code', async () => {
    const sourceCode = `
      {% if some_variable %}
        Hello, world!
      {% endif %}
      {% schema %}
      {
        "settings": [{ "visible_if": "{{ foo.bar == true }}" }]
      }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should report complementary Ruby Liquid syntax errors', async () => {
    const sourceCode = `{{ @ }}`;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal('Syntax error in variable output');
  });

  it('should report complementary Ruby Liquid syntax errors in echo tags', async () => {
    const sourceCode = `{% echo @ %}`;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("Syntax error in 'echo' tag");
    expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
  });

  it('should adapt complementary syntax ranges to target parser nodes', async () => {
    const cases = [
      {
        source: '{{ @ }}',
        highlight: '{{ @ }}',
        message: 'Syntax error in variable output',
      },
      {
        source: '{% echo @ %}',
        highlight: '{% echo @ %}',
        message: "Syntax error in 'echo' tag",
      },
      {
        source: '{% if true %}x{% elsif [0] %}y{% endif %}',
        highlight: '{% elsif [0] %}',
        message: 'Bare bracket access is not allowed in strict2 mode',
      },
      {
        source: '{% raw @ %}x{% endraw %}',
        highlight: '{% raw @ %}',
        message: "Liquid syntax error: Syntax Error in 'raw' - Valid syntax: raw",
      },
      {
        source: '{% liquid\n if [0]\n endif\n%}',
        highlight: 'if [0]',
        message: 'Bare bracket access is not allowed in strict2 mode',
      },
    ];

    for (const { source, highlight, message } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(message);
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should strip non-word tag names from complementary markup ranges', async () => {
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, '{% #\nworld %}');

    expect(offenses).to.be.empty;
  });

  it('should accept Ruby-compatible include snippet expressions', async () => {
    const sourceCode = `
      {% include -5 %}
      {% include product.title %}
      {% include products[0] %}
      {% include a.b.c %}
      {% include a[0].b %}
      {% include (1..5) %}
    `;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

    expect(offenses).to.be.empty;
  });

  it('should report misplaced elsif branches in non-if blocks', async () => {
    const cases = [
      '{% case x %}{% elsif %}{% endcase %}',
      '{% for i in (1..3) %}{% elsif %}{% endfor %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Unknown tag 'elsif'");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(
        '{% elsif %}',
      );
    }
  });

  it('should report trailing comma markup in parsed tags', async () => {
    const cases = [
      {
        source: '{% for product in products , %}{% endfor %}',
        highlight: '{% for product in products , %}{% endfor %}',
        message: "Syntax error in 'for' tag",
      },
      {
        source: '{% form product , %}{% endform %}',
        highlight: '{% form product , %}{% endform %}',
        message: "Syntax error in 'form' tag",
      },
    ];

    for (const { source, highlight, message } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(message);
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report duplicate paginate comma separators', async () => {
    const cases = [
      {
        source: '{% paginate products by 12 , , %}{% endpaginate %}',
        highlight: '{% paginate products by 12 , , %}',
      },
      {
        source: '{% paginate products by 12 , , page_size: , %}{% endpaginate %}',
        highlight: '{% paginate products by 12 , , page_size: , %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const sourceCode = source;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Syntax error in 'paginate' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(highlight);
    }
  });

  it('should report comment block source structure errors', async () => {
    const cases = [
      {
        source: '{% comment %}hello',
        highlight: '{% comment %}',
        message: "Liquid syntax error: 'comment' tag was never closed",
      },
      {
        source: '{% comment %}{% raw %}hello',
        highlight: '{% raw %}',
        message: "Liquid syntax error: 'raw' tag was never closed",
      },
      {
        source: '{% endcomment %}',
        highlight: '{% endcomment %}',
        message: "Liquid syntax error: Unknown tag 'endcomment'",
      },
    ];

    for (const { source, highlight, message } of cases) {
      const sourceCode = source;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(message);
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(highlight);
    }
  });

  it('should report javascript block source structure errors', async () => {
    const cases = [
      {
        source: '{%- javascript foo -%}{%- endjavascript -%}',
        highlight: '{%- javascript foo -%}',
        message: "Syntax Error in 'javascript' - Valid syntax: javascript",
      },
      {
        source: '{% javascript %}content',
        highlight: '{% javascript %}',
        message: "'javascript' tag was never closed",
      },
      {
        source: '{% endjavascript %}',
        highlight: '{% endjavascript %}',
        message: "Unknown tag 'endjavascript'",
      },
    ];

    for (const { source, highlight, message } of cases) {
      const sourceCode = source;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(message);
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(highlight);
    }
  });

  it('should report schema opening markup source structure errors', async () => {
    const sourceCode = '{% schema extra %}{{ x }}{% endschema %}';
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "Liquid syntax error: Syntax Error in 'schema' - Valid syntax: schema",
    );
    expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(
      '{% schema extra %}',
    );
  });

  it('should report raw block source structure errors', async () => {
    const cases = [
      {
        source: '{% raw foo bar %}{% endraw %}',
        highlight: '{% raw foo bar %}',
        message: "Liquid syntax error: Syntax Error in 'raw' - Valid syntax: raw",
      },
      {
        source: '{%- raw foo -%}{%- endraw -%}',
        highlight: '{%- raw foo -%}',
        message: "Liquid syntax error: Syntax Error in 'raw' - Valid syntax: raw",
      },
      {
        source: '{% raw %}content',
        highlight: '{% raw %}',
        message: "Liquid syntax error: 'raw' tag was never closed",
      },
      {
        source: '{% endraw %}',
        highlight: '{% endraw %}',
        message: "Liquid syntax error: Unknown tag 'endraw'",
      },
    ];

    for (const { source, highlight, message } of cases) {
      const sourceCode = source;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(message);
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(highlight);
    }
  });

  it('should report doc block source structure errors', async () => {
    const cases = [
      {
        source: '{%- doc foo -%}{%- enddoc -%}',
        highlight: '{%- doc foo -%}',
        message: "Liquid syntax error: Syntax Error in 'doc' - Valid syntax: {% doc %}{% enddoc %}",
      },
      {
        source: '{% doc %}{% doc %}{% enddoc %}{% enddoc %}',
        highlight: '{% doc %}',
        message: "Liquid syntax error: Syntax Error in 'doc' - Nested doc tags are not allowed",
      },
      {
        source: '{% doc %}content',
        highlight: '{% doc %}',
        message: "Liquid syntax error: 'doc' tag was never closed",
      },
      {
        source: '{% enddoc %}',
        highlight: '{% enddoc %}',
        message: "Liquid syntax error: Unknown tag 'enddoc'",
      },
    ];

    for (const { source, highlight, message } of cases) {
      const sourceCode = source;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(message);
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(highlight);
    }
  });

  it('should report if trailing parsed markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if product.available %}{% endif %}')).to
      .be.empty;

    const cases = [
      '{% if product.available extra %}{% endif %}',
      '{% if product.available | %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if logical operand markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% if product.available and true %}{% endif %}'),
    ).to.be.empty;

    const cases = [
      '{% if product.available and @ %}{% endif %}',
      '{% if product.available and "hello %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if comparison rhs operator markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if product == value %}{% endif %}')).to
      .be.empty;

    const cases = [
      '{% if product == == %}{% endif %}',
      '{% if product == contains %}{% endif %}',
      '{% if product == | %}{% endif %}',
      '{% if product == . %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if comparison rhs lookup markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if product == collection.product %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      '{% if product == collection. %}{% endif %}',
      '{% if product == collection.123 %}{% endif %}',
      '{% if product == collection[0 %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if boolean comparison rhs lookup markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if product and product == collection.product %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      '{% if product and product == collection. %}{% endif %}',
      '{% if product and product == collection.123 %}{% endif %}',
      '{% if product and product == collection["product" %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if boolean comparison rhs markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if product and product == collection.product %}{% endif %}',
      ),
    ).to.be.empty;
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if x and x x == y %}{% endif %}')).to.be
      .empty;

    const cases = [
      '{% if product and product == %}{% endif %}',
      '{% if product and product == [0] %}{% endif %}',
      '{% if product and product == == %}{% endif %}',
      '{% if product and product == != %}{% endif %}',
      '{% if product and product == <= %}{% endif %}',
      '{% if product and product == >= %}{% endif %}',
      '{% if product and product == < %}{% endif %}',
      '{% if product and product == > %}{% endif %}',
      '{% if product and product == contains %}{% endif %}',
      '{% if product and product == | %}{% endif %}',
      '{% if product and product == .. %}{% endif %}',
      '{% if x and x x == @ %}{% endif %}',
      '{% if x and x x == "hello %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if boolean expression comparison markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if x and x %}{% endif %}')).to.be.empty;

    const cases = ['{% if x and x < %}{% endif %}', '{% if x and x > %}{% endif %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if boolean expression lookup markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if x and x.product %}{% endif %}')).to.be
      .empty;

    const cases = [
      '{% if x and x collection. %}{% endif %}',
      '{% if x and x collection.123 %}{% endif %}',
      '{% if x and x collection[0 %}{% endif %}',
      '{% if x and x collection[,] %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if boolean expression token markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if x and y %}{% endif %}')).to.be.empty;

    const cases = ['{% if x and x | %}{% endif %}', '{% if x and x .. %}{% endif %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if boolean expression lexer markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if x and y %}{% endif %}')).to.be.empty;

    const cases = ['{% if x and x @ %}{% endif %}', '{% if x and x "hello %}{% endif %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if comparison rhs lexer markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if product == value %}{% endif %}')).to
      .be.empty;

    const cases = ['{% if product == @ %}{% endif %}', '{% if product == "value %}{% endif %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if condition lookup markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if collection.product %}{% endif %}')).to
      .be.empty;

    const cases = [
      '{% if collection.123 %}{% endif %}',
      '{% if collection["product" %}{% endif %}',
      '{% if collection[,] %}{% endif %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if condition lexer markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if product %}{% endif %}')).to.be.empty;

    const cases = ['{% if ^ %}{% endif %}', '{% if "hello %}{% endif %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid if condition token markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if product %}{% endif %}')).to.be.empty;

    const cases = ['{% if | %}{% endif %}', '{% if contains %}{% endif %}', '{% if  %}{% endif %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'if' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report unless trailing parsed markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless product.available %}{% endunless %}'),
    ).to.be.empty;

    const cases = [
      '{% unless product.available extra %}{% endunless %}',
      '{% unless product.available | %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless logical operand markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% unless product.available and true %}{% endunless %}',
      ),
    ).to.be.empty;

    const cases = [
      '{% unless product.available and @ %}{% endunless %}',
      '{% unless product.available and "hello %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless comparison rhs operator markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless product == value %}{% endunless %}'),
    ).to.be.empty;

    const cases = [
      '{% unless product == == %}{% endunless %}',
      '{% unless product == contains %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless boolean comparison rhs lookup markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% unless product and product == collection.product %}{% endunless %}',
      ),
    ).to.be.empty;

    const cases = [
      '{% unless product and product == collection. %}{% endunless %}',
      '{% unless product and product == collection.123 %}{% endunless %}',
      '{% unless product and product == collection["product" %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless boolean comparison rhs markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% unless product and product == collection.product %}{% endunless %}',
      ),
    ).to.be.empty;

    const cases = [
      '{% unless product and product == %}{% endunless %}',
      '{% unless product and product == [0] %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless boolean expression comparison markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless x and x %}{% endunless %}')).to.be
      .empty;

    const cases = [
      '{% unless x and x < %}{% endunless %}',
      '{% unless x and x > %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless boolean expression lookup markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless x and x.product %}{% endunless %}'),
    ).to.be.empty;

    const cases = [
      '{% unless x and x collection. %}{% endunless %}',
      '{% unless x and x collection.123 %}{% endunless %}',
      '{% unless x and x collection[0 %}{% endunless %}',
      '{% unless x and x collection[,] %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless boolean expression token markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless x and y %}{% endunless %}')).to.be
      .empty;

    const cases = ['{% unless x and | %}{% endunless %}', '{% unless x and .. %}{% endunless %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless boolean expression lexer markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless x and y %}{% endunless %}')).to.be
      .empty;

    const cases = [
      '{% unless x and @ %}{% endunless %}',
      '{% unless x and "hello %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless condition lookup markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless collection.product %}{% endunless %}'),
    ).to.be.empty;

    const cases = [
      '{% unless collection.123 %}{% endunless %}',
      '{% unless collection["product" %}{% endunless %}',
      '{% unless collection[,] %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless condition lexer markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless product %}{% endunless %}')).to.be
      .empty;

    const cases = ['{% unless ^ %}{% endunless %}', '{% unless "hello %}{% endunless %}'];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report invalid unless condition token markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% unless product %}{% endunless %}')).to.be
      .empty;

    const cases = [
      '{% unless | %}{% endunless %}',
      '{% unless contains %}{% endunless %}',
      '{% unless  %}{% endunless %}',
    ];

    for (const sourceCode of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'unless' tag");
      expect(highlightedOffenses({ 'file.liquid': sourceCode }, offenses)).to.include(sourceCode);
    }
  });

  it('should report elsif trailing parsed markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if false %}{% elsif product.available %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif product.available extra %}{% endif %}',
        highlight: '{% elsif product.available extra %}',
      },
      {
        source: '{% if false %}{% elsif product.available | %}{% endif %}',
        highlight: '{% elsif product.available | %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif logical operand markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if false %}{% elsif product.available and true %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif product.available and @ %}{% endif %}',
        highlight: '{% elsif product.available and @ %}',
      },
      {
        source: '{% if false %}{% elsif product.available and "hello %}{% endif %}',
        highlight: '{% elsif product.available and "hello %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif condition lookup markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if false %}{% elsif collection.product %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif collection.123 %}{% endif %}',
        highlight: '{% elsif collection.123 %}',
      },
      {
        source: '{% if false %}{% elsif collection["product" %}{% endif %}',
        highlight: '{% elsif collection["product" %}',
      },
      {
        source: '{% if false %}{% elsif collection[,] %}{% endif %}',
        highlight: '{% elsif collection[,] %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif comparison rhs markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if false %}{% elsif product == available %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif product == | %}{% endif %}',
        highlight: '{% elsif product == | %}',
      },
      {
        source: '{% if false %}{% elsif product == == %}{% endif %}',
        highlight: '{% elsif product == == %}',
      },
      {
        source: '{% if false %}{% elsif product == collection.123 %}{% endif %}',
        highlight: '{% elsif product == collection.123 %}',
      },
      {
        source: '{% if false %}{% elsif product == @ %}{% endif %}',
        highlight: '{% elsif product == @ %}',
      },
      {
        source: '{% if false %}{% elsif product == ) %}{% endif %}',
        highlight: '{% elsif product == ) %}',
      },
      {
        source: '{% if false %}{% elsif product == (1..5 %}{% endif %}',
        highlight: '{% elsif product == (1..5 %}',
      },
      {
        source: '{% if false %}{% elsif product == (1..) %}{% endif %}',
        highlight: '{% elsif product == (1..) %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif boolean expression comparison markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if false %}{% elsif x and x == y %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif x and x == %}{% endif %}',
        highlight: '{% elsif x and x == %}',
      },
      {
        source: '{% if false %}{% elsif x and x != %}{% endif %}',
        highlight: '{% elsif x and x != %}',
      },
      {
        source: '{% if false %}{% elsif x and x < %}{% endif %}',
        highlight: '{% elsif x and x < %}',
      },
      {
        source: '{% if false %}{% elsif x and x > %}{% endif %}',
        highlight: '{% elsif x and x > %}',
      },
      {
        source: '{% if false %}{% elsif x and x <= %}{% endif %}',
        highlight: '{% elsif x and x <= %}',
      },
      {
        source: '{% if false %}{% elsif x and x >= %}{% endif %}',
        highlight: '{% elsif x and x >= %}',
      },
      {
        source: '{% if false %}{% elsif x and x contains %}{% endif %}',
        highlight: '{% elsif x and x contains %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif boolean expression lookup markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% if false %}{% elsif x and x %}{% endif %}'),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif x and x x. %}{% endif %}',
        highlight: '{% elsif x and x x. %}',
      },
      {
        source: '{% if false %}{% elsif x and x x.123 %}{% endif %}',
        highlight: '{% elsif x and x x.123 %}',
      },
      {
        source: '{% if false %}{% elsif x and x x."y" %}{% endif %}',
        highlight: '{% elsif x and x x."y" %}',
      },
      {
        source: '{% if false %}{% elsif x and x x[0 %}{% endif %}',
        highlight: '{% elsif x and x x[0 %}',
      },
      {
        source: '{% if false %}{% elsif x and x x[,] %}{% endif %}',
        highlight: '{% elsif x and x x[,] %}',
      },
      {
        source: '{% if false %}{% elsif x and x (1..5 %}{% endif %}',
        highlight: '{% elsif x and x (1..5 %}',
      },
      {
        source: '{% if false %}{% elsif x and x (1, 5) %}{% endif %}',
        highlight: '{% elsif x and x (1, 5) %}',
      },
      {
        source: '{% if false %}{% elsif x and x (1..) %}{% endif %}',
        highlight: '{% elsif x and x (1..) %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif boolean comparison rhs operator markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if false %}{% elsif x and x == y %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif x and x == == %}{% endif %}',
        highlight: '{% elsif x and x == == %}',
      },
      {
        source: '{% if false %}{% elsif x and x == != %}{% endif %}',
        highlight: '{% elsif x and x == != %}',
      },
      {
        source: '{% if false %}{% elsif x and x == < %}{% endif %}',
        highlight: '{% elsif x and x == < %}',
      },
      {
        source: '{% if false %}{% elsif x and x == > %}{% endif %}',
        highlight: '{% elsif x and x == > %}',
      },
      {
        source: '{% if false %}{% elsif x and x == <= %}{% endif %}',
        highlight: '{% elsif x and x == <= %}',
      },
      {
        source: '{% if false %}{% elsif x and x == >= %}{% endif %}',
        highlight: '{% elsif x and x == >= %}',
      },
      {
        source: '{% if false %}{% elsif x and x == contains %}{% endif %}',
        highlight: '{% elsif x and x == contains %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif boolean comparison rhs lookup markup', async () => {
    expect(
      await runLiquidCheck(
        LiquidHTMLSyntaxError,
        '{% if false %}{% elsif x and x == y %}{% endif %}',
      ),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif x and x == collection. %}{% endif %}',
        highlight: '{% elsif x and x == collection. %}',
      },
      {
        source: '{% if false %}{% elsif x and x == collection.123 %}{% endif %}',
        highlight: '{% elsif x and x == collection.123 %}',
      },
      {
        source: '{% if false %}{% elsif x and x == collection["product" %}{% endif %}',
        highlight: '{% elsif x and x == collection["product" %}',
      },
      {
        source: '{% if false %}{% elsif x and x == (1..5 %}{% endif %}',
        highlight: '{% elsif x and x == (1..5 %}',
      },
      {
        source: '{% if false %}{% elsif x and x == (1..) %}{% endif %}',
        highlight: '{% elsif x and x == (1..) %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif boolean expression token markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% if false %}{% elsif x and x %}{% endif %}'),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif x and x | %}{% endif %}',
        highlight: '{% elsif x and x | %}',
      },
      {
        source: '{% if false %}{% elsif x and x , %}{% endif %}',
        highlight: '{% elsif x and x , %}',
      },
      {
        source: '{% if false %}{% elsif x and x : %}{% endif %}',
        highlight: '{% elsif x and x : %}',
      },
      {
        source: '{% if false %}{% elsif x and x ] %}{% endif %}',
        highlight: '{% elsif x and x ] %}',
      },
      {
        source: '{% if false %}{% elsif x and x ) %}{% endif %}',
        highlight: '{% elsif x and x ) %}',
      },
      {
        source: '{% if false %}{% elsif x and x ? %}{% endif %}',
        highlight: '{% elsif x and x ? %}',
      },
      {
        source: '{% if false %}{% elsif x and x - %}{% endif %}',
        highlight: '{% elsif x and x - %}',
      },
      {
        source: '{% if false %}{% elsif x and x .. %}{% endif %}',
        highlight: '{% elsif x and x .. %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif boolean expression lexer markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% if false %}{% elsif x and x %}{% endif %}'),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif x and x @ %}{% endif %}',
        highlight: '{% elsif x and x @ %}',
      },
      {
        source: '{% if false %}{% elsif x and x # %}{% endif %}',
        highlight: '{% elsif x and x # %}',
      },
      {
        source: '{% if false %}{% elsif x and x $ %}{% endif %}',
        highlight: '{% elsif x and x $ %}',
      },
      {
        source: '{% if false %}{% elsif x and x ^ %}{% endif %}',
        highlight: '{% elsif x and x ^ %}',
      },
      {
        source: '{% if false %}{% elsif x and x & %}{% endif %}',
        highlight: '{% elsif x and x & %}',
      },
      {
        source: '{% if false %}{% elsif x and x * %}{% endif %}',
        highlight: '{% elsif x and x * %}',
      },
      {
        source: '{% if false %}{% elsif x and x ~ %}{% endif %}',
        highlight: '{% elsif x and x ~ %}',
      },
      {
        source: '{% if false %}{% elsif x and x ` %}{% endif %}',
        highlight: '{% elsif x and x ` %}',
      },
      {
        source: '{% if false %}{% elsif x and x \\ %}{% endif %}',
        highlight: '{% elsif x and x \\ %}',
      },
      {
        source: '{% if false %}{% elsif x and x ; %}{% endif %}',
        highlight: '{% elsif x and x ; %}',
      },
      {
        source: '{% if false %}{% elsif x and x "hello %}{% endif %}',
        highlight: '{% elsif x and x "hello %}',
      },
      {
        source: "{% if false %}{% elsif x and x 'hello %}{% endif %}",
        highlight: "{% elsif x and x 'hello %}",
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif condition range markup', async () => {
    expect(
      await runLiquidCheck(LiquidHTMLSyntaxError, '{% if false %}{% elsif (1..5) %}{% endif %}'),
    ).to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif (1..5 %}{% endif %}',
        highlight: '{% elsif (1..5 %}',
      },
      {
        source: '{% if false %}{% elsif (1, 5) %}{% endif %}',
        highlight: '{% elsif (1, 5) %}',
      },
      {
        source: '{% if false %}{% elsif (1..) %}{% endif %}',
        highlight: '{% elsif (1..) %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report invalid elsif condition token markup', async () => {
    expect(await runLiquidCheck(LiquidHTMLSyntaxError, '{% if false %}{% elsif true %}{% endif %}'))
      .to.be.empty;

    const cases = [
      {
        source: '{% if false %}{% elsif | %}{% endif %}',
        highlight: '{% elsif | %}',
      },
      {
        source: '{% if false %}{% elsif contains %}{% endif %}',
        highlight: '{% elsif contains %}',
      },
      {
        source: '{% if false %}{% elsif  %}{% endif %}',
        highlight: '{% elsif  %}',
      },
    ];

    for (const { source, highlight } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal("Liquid syntax error: Syntax error in 'elsif' tag");
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should report bare contains in value expression slots', async () => {
    const cases = [
      {
        source: '{% assign x = contains %}',
        highlight: '{% assign x = contains %}',
        message: "Syntax error in 'assign' tag",
      },
      {
        source: '{{ product.title | append: contains }}',
        highlight: '{{ product.title | append: contains }}',
        message: 'Syntax error in variable output',
      },
      {
        source: '{% case x %}{% when contains %}{% endcase %}',
        highlight: '{% when contains %}',
        message: "Syntax error in 'when' tag",
      },
      {
        source: "{% render 'snippet' for contains %}",
        highlight: "{% render 'snippet' for contains %}",
        message: "Syntax error in 'render' tag",
      },
      {
        source: '{% include x for contains %}',
        highlight: '{% include x for contains %}',
        message: "Syntax error in 'include' tag",
      },
      {
        source: '{{ contains }}',
        highlight: '{{ contains }}',
        message: 'Syntax error in variable output',
      },
    ];

    for (const { source, highlight, message } of cases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(message);
      expect(highlightedOffenses({ 'file.liquid': source }, offenses)).to.include(highlight);
    }
  });

  it('should highligh the error', async () => {
    let offenses: Offense[];
    let highlights: string[];
    let source: string;

    source = `<div><a></b></div>`;
    offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
    highlights = highlightedOffenses({ 'file.liquid': source }, offenses);
    expect(highlights).to.include('<a></b>');

    source = `<div><a>{% endif %}</div>`;
    offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
    highlights = highlightedOffenses({ 'file.liquid': source }, offenses);
    expect(highlights).to.include('<a>{% endif %}');

    source = `<a href=abc ">`;
    offenses = await runLiquidCheck(LiquidHTMLSyntaxError, source);
    highlights = highlightedOffenses({ 'file.liquid': source }, offenses);
    expect(highlights).to.include('"');
  });
});
