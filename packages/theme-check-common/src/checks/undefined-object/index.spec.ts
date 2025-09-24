import { expect, describe, it, assert } from 'vitest';
import { UndefinedObject } from './index';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { Offense } from '../../types';

describe('Module: UndefinedObject', () => {
  it('should report an offense when object is undefined', async () => {
    const sourceCode = `
      {{ my_var }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'my_var' used."]);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['my_var']);
  });

  it('should report an offense when object with an attribute is undefined', async () => {
    const sourceCode = `
      {{ my_var.my_attr }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'my_var' used."]);
  });

  it('should report an offense when undefined object is used as an argument', async () => {
    const sourceCode = `
      {{ product[my_object] }}
      {{ product[my_object] }}

      {% comment %} string arguments should not be reported {% endcomment %}
      {{ product["my_object"] }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(2);
    expect(offenses.map((e) => e.message)).toEqual([
      "Unknown object 'my_object' used.",
      "Unknown object 'my_object' used.",
    ]);
  });

  it('should report an offense when object is undefined in a Liquid tag', async () => {
    const sourceCode = `
    {% liquid
      echo my_var
    %}
  `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'my_var' used."]);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['my_var']);
  });

  it('should not report an offense when object is defined with an assign tag', async () => {
    const sourceCode = `
      {% assign my_var = "value" %}
      {{ my_var }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when object is defined with an assign tag and it is used as an argument', async () => {
    const sourceCode = `
      {% assign prop = "title" %}
      {{ product[prop] }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when object is defined with an assign tag in a Liquid tag', async () => {
    const sourceCode = `
      {% liquid
        assign my_var = "value"
        echo my_var
      %}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when object is defined with a capture tag', async () => {
    const sourceCode = `
      {% capture my_var %} value {% endcapture %}
      {{ my_var }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when object is defined in a for loop', async () => {
    const sourceCode = `
      {% for c in collections %}
        {{ c }}
      {% endfor %}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense when object is defined in a for loop but used outside of the scope', async () => {
    const sourceCode = `
      {% for c in collections %}
        {{ c }}
      {% endfor %}{{ c }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'c' used."]);
  });

  it('should report an offense when object is defined in a for loop but used outside of the scope (in scenarios where the same variable has multiple scopes in the file)', async () => {
    const sourceCode = `
      {% for c in collections %}
        {% comment %} -- Scope 1 -- {% endcomment %}
        {{ c }}
      {% endfor %}
      {{ c }}
      {% for c in collections %}
        {% comment %} -- Scope 2 -- {% endcomment %}
        {{ c }}
      {% endfor %}
      {{ c }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(2);
    expect(offenses.map((e) => e.message)).toEqual([
      "Unknown object 'c' used.",
      "Unknown object 'c' used.",
    ]);
  });

  it('should report an offense when undefined object defines another object', async () => {
    const sourceCode = `
      {% assign my_object = my_var %}
      {{ my_object }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'my_var' used."]);
  });

  it('should not report an offense when object is defined in a tablerow loop', async () => {
    const sourceCode = `
      {% tablerow c in collections %}
        {{ c }}
      {% endtablerow %}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense when object is defined in a tablerow loop but used outside of the scope', async () => {
    const sourceCode = `
      {% tablerow c in collections %}
        {{ c }}
      {% endtablerow %}{{ c }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'c' used."]);
  });

  it('should contextually report on the undefined nature of the paginate object (defined in paginate tag, undefined outside)', async () => {
    const sourceCode = `
      {% assign col = 'string' | split: '' %}
      {% paginate col by 5 %}
        {{ paginate }}
      {% endpaginate %}{{ paginate }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'paginate' used."]);
  });

  it('should contextually report on the undefined nature of the form object (defined in form tag, undefined outside)', async () => {
    const sourceCode = `
      {% form "cart" %}
        {{ form }}
      {% endform %}{{ form }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'form' used."]);
  });

  it('should support {% layout none %}', async () => {
    const sourceCode = `
      {% layout none %}
      {{ none }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'none' used."]);
  });

  it('should support {% increment var %} and {% decrement var %}', async () => {
    for (const tag of ['increment', 'decrement']) {
      const sourceCode = `
        {% ${tag} var %}
        {{ var }}
      `;

      const offenses = await runLiquidCheck(UndefinedObject, sourceCode);
      expect(offenses).toHaveLength(0);
    }
  });

  it('should not report an offense when object is undefined in a "snippet" file with no presense of doc tags', async () => {
    const sourceCode = `
      {{ my_var }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, 'snippets/file.liquid');

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense when object is undefined in a "snippet" file with doc tags that are missing the associated param', async () => {
    const sourceCode = `
    {% doc %}
    {% enddoc %}
    {{ my_var }}
      `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, 'snippets/file.liquid');

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'my_var' used."]);
  });

  it('should not report an offense when object is defined with @param in a snippet file', async () => {
    const sourceCode = `
      {% doc %}
        @param {string} text
      {% enddoc %}

      {{ text }}
    `;

    const filePath = 'snippets/file.liquid';
    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, filePath);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense when object is not global', async () => {
    const sourceCode = `
      {{ image }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses.map((e) => e.message)).toEqual(["Unknown object 'image' used."]);
  });

  it('should not report an offense for forloop/tablerowloop variables when in the correct context', async () => {
    for (const tag of ['for', 'tablerow']) {
      const sourceCode = `
        {% ${tag} x in collections %}
          {{ ${tag}loop }}
        {% end${tag} %}
      `;

      const offenses = await runLiquidCheck(UndefinedObject, sourceCode, 'file.liquid');

      expect(offenses).toHaveLength(0);
    }
  });

  it('should support contextual exceptions', async () => {
    let offenses: Offense[];
    const contexts: [string, string][] = [
      ['section', 'sections/section.liquid'],
      ['predictive_search', 'sections/predictive-search.liquid'],
      ['recommendations', 'sections/recommendations.liquid'],
      ['comment', 'sections/main-article.liquid'],
      ['block', 'blocks/theme-app-extension.liquid'],
      ['app', 'blocks/theme-app-extension.liquid'],
      ['app', 'snippets/theme-app-extension.liquid'],
    ];
    for (const [object, goodPath] of contexts) {
      offenses = await runLiquidCheck(UndefinedObject, `{{ ${object} }}`, goodPath);
      expect(offenses).toHaveLength(0);
      offenses = await runLiquidCheck(UndefinedObject, `{{ ${object} }}`, 'file.liquid');
      expect(offenses).toHaveLength(1);
    }
  });

  it('should support contextual exceptions for checkout.liquid', async () => {
    let offenses: Offense[];
    const contexts: [string, string][] = [
      ['locale', 'layout/checkout.liquid'],
      ['direction', 'layout/checkout.liquid'],
      ['skip_to_content_link', 'layout/checkout.liquid'],
      ['checkout_html_classes', 'layout/checkout.liquid'],
      ['checkout_stylesheets', 'layout/checkout.liquid'],
      ['checkout_scripts', 'layout/checkout.liquid'],
      ['content_for_logo', 'layout/checkout.liquid'],
      ['breadcrumb', 'layout/checkout.liquid'],
      ['order_summary_toggle', 'layout/checkout.liquid'],
      ['content_for_order_summary', 'layout/checkout.liquid'],
      ['alternative_payment_methods', 'layout/checkout.liquid'],
      ['content_for_footer', 'layout/checkout.liquid'],
      ['tracking_code', 'layout/checkout.liquid'],
    ];
    for (const [object, goodPath] of contexts) {
      offenses = await runLiquidCheck(UndefinedObject, `{{ ${object} }}`, goodPath);
      expect(offenses).toHaveLength(0);
      offenses = await runLiquidCheck(UndefinedObject, `{{ ${object} }}`, 'file.liquid');
      expect(offenses).toHaveLength(1);
    }
  });

  it('should report an offense for forloop/tablerowloop used outside of context', async () => {
    const sourceCode = `
      {{ forloop }}
      {{ tablerowloop }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, 'file.liquid');

    expect(offenses).toHaveLength(2);
  });

  it('should not report an offenses when definitions for global objects are unavailable', async () => {
    const sourceCode = `
      {{ my_var }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, 'file.liquid', {
      themeDocset: undefined,
    });

    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when object is defined with @param in a block file', async () => {
    const sourceCode = `
      {% doc %}
        @param {string} text
      {% enddoc %}

      {{ text }}
    `;

    const filePath = 'blocks/my-custom-block.liquid';
    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, filePath);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense when an undefined object is used alongside @param in a block file', async () => {
    const sourceCode = `
      {% doc %}
        @param {string} text
      {% enddoc %}

      {{ text }}
      {{ undefined_variable }}
    `;

    const filePath = 'blocks/my-custom-block.liquid';
    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, filePath);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Unknown object 'undefined_variable' used.");
  });

  it('should not report an offense when a self defined variable is defined with a @param tag', async () => {
    const sourceCode = `
      {% doc %}
        @param {string} text
      {% enddoc %}

      {% assign text = text | default: "value" %}
    `;

    const filePath = 'snippets/file.liquid';
    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, filePath);

    expect(offenses).toHaveLength(0);
  });

  it('should report an offense when assigning an undefined variable to itself', async () => {
    const sourceCode = `
      {% assign my_var = my_var | default: "fallback" %}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Unknown object 'my_var' used.");
  });

  it('should not report an offense when using variables inside visible_if statements in a schema tag', async () => {
    const sourceCode = `
    {% schema %}
    {
      "settings": [
        {
          "type": "text",
          "label": "foo",
          "id": "foo",
        }
        {
          "type": "text",
          "label": "bar",
          "id": "bar",
          "visible_if": "{{ block.settings.foo }}",
        }
      ]
    }
    {% endschema %}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode);

    assert(offenses.length == 0);
    expect(offenses).to.be.empty;
  });
});
