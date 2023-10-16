import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { DeprecatedTag } from './index';

describe('Module: DeprecatedTag', () => {
  it('should report an offense when include tag is used', async () => {
    const sourceCode = `
      {% include 'templates/foo.liquid' %}
    `;
    const offenses = await runLiquidCheck(DeprecatedTag, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(`Use the 'render' tag instead of 'include'`);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['include']);
  });

  it('should not report an offense when render tag is used', async () => {
    const sourceCode = `
      {% render 'templates/foo.liquid' %}
    `;
    const offenses = await runLiquidCheck(DeprecatedTag, sourceCode);

    expect(offenses).toHaveLength(0);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toHaveLength(0);
  });

  it('should suggest replacing include tag with render tag', async () => {
    const sourceCode = `
      {% include 'foo.liquid' %}
      {% assign greeting = "hello world" %}
      {% include 'greeting.liquid' %}
    `;
    const offenses = await runLiquidCheck(DeprecatedTag, sourceCode);

    expect(offenses).toHaveLength(2);
    if (!offenses[0].suggest || !offenses[1].suggest) return;

    expect(offenses[0].suggest[0].message).toEqual(`Replace 'include' with 'render'`);
    expect(offenses[1].suggest[0].message).toEqual(`Replace 'include' with 'render'`);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toHaveLength(2);
    expect(highlights[0]).toBe('include');
    expect(highlights[1]).toBe('include');
  });

  it('should report multiple offenses when multiple include tags are used in the same line', async () => {
    const sourceCode = "{% include 'foo.liquid' %} Some text {% include 'bar.liquid' %}";
    const offenses = await runLiquidCheck(DeprecatedTag, sourceCode);

    expect(offenses).toHaveLength(2);
  });

  it('should report offenses when include tags are nested', async () => {
    const sourceCode = "{% if true %} {% include 'foo.liquid' %} {% endif %}";
    const offenses = await runLiquidCheck(DeprecatedTag, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(`Use the 'render' tag instead of 'include'`);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual(['include']);
  });
});
