import { expect, describe, it } from 'vitest';
import { UndefinedObject } from './index';
import { runLiquidCheck, highlightedOffenses } from '../../test';

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

  it('should not report an offense when object is undefined in a "snippet" file', async () => {
    const sourceCode = `
      {{ my_var }}
    `;

    const offenses = await runLiquidCheck(UndefinedObject, sourceCode, 'snippets/file.liquid');

    expect(offenses).toHaveLength(0);
  });
});