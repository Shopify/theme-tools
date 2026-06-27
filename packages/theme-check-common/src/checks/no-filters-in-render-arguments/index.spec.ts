import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { NoFiltersInRenderArguments } from './index';

describe('Module: NoFiltersInRenderArguments', () => {
  it('reports an offense when a render argument uses a filter', async () => {
    const sourceCode = `{% render 'foo', param1: 'bar', param2: 'hello' | append: ' world' %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain(
      "Filters cannot be used on arguments passed to the 'render' tag",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual([`| append: ' world'`]);
  });

  it('reports an offense when an include argument uses a filter', async () => {
    const sourceCode = `{% include 'foo', x: bar | upcase %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain(
      "Filters cannot be used on arguments passed to the 'include' tag",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual([`| upcase`]);
  });

  it('does not report when no filter is used', async () => {
    const sourceCode = `{% render 'foo', param1: 'bar', param2: 'hello' %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('reports an offense when a content_for argument uses a filter', async () => {
    const sourceCode = `{% content_for 'block', type: 'foo', id: 'bar' | append: 'x' %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain(
      "Filters cannot be used on arguments passed to the 'content_for' tag",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual([`| append: 'x'`]);
  });

  it('does not report a false positive for a pipe inside a string literal', async () => {
    const sourceCode = `{% render 'foo', sep: 'a|b' %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('does not report a false positive for a quoted pipe even when strict parse fails', async () => {
    // `invalid_argument` forces the strict parse to fail, so the raw-markup
    // scanner runs while the only pipe is still inside a quoted string literal.
    const sourceCode = `{% render 'foo', sep: 'a|b', invalid_argument %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('does not report a false positive for a double-quoted pipe even when strict parse fails', async () => {
    const sourceCode = `{% render 'foo', sep: "a|b", invalid_argument %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('highlights the real filter when a quoted pipe precedes it', async () => {
    const sourceCode = `{% render 'foo', sep: 'a|b', x: bar | upcase %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(1);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual([`| upcase`]);
  });

  it('reports distinct highlights for two render tags on one line', async () => {
    const sourceCode = `{% render 'foo', x: a | upcase %} {% render 'bar', y: b | downcase %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(2);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual([`| upcase`, `| downcase`]);
  });

  it('reports an offense for a render statement inside a {% liquid %} tag', async () => {
    const sourceCode = `{% liquid\n  render 'foo', x: bar | upcase\n%}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(1);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toEqual([`| upcase`]);
  });

  it('does not report on a plain render with no arguments', async () => {
    const sourceCode = `{% render 'foo' %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('reports offenses on nested render tags', async () => {
    const sourceCode = `{% if true %}{% render 'foo', x: bar | upcase %}{% endif %}`;
    const offenses = await runLiquidCheck(NoFiltersInRenderArguments, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain(
      "Filters cannot be used on arguments passed to the 'render' tag",
    );
  });
});
