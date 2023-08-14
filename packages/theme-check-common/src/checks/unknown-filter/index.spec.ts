import { describe, it, expect } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { UnknownFilter } from './index';

describe('Module: UnknownFilter', () => {
  it('should report an offense when an unknown filter is used', async () => {
    const sourceCode = `{{ "hello" | unknown_filter }}`;
    const offenses = await runLiquidCheck(UnknownFilter, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Unknown filter 'unknown_filter' used.");

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql('| unknown_filter');
  });

  it('reports on unknown filter', async () => {
    const sourceCode = `{{ "foo" | bar }}`;
    const offenses = await runLiquidCheck(UnknownFilter, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Unknown filter 'bar' used.");

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql('| bar');
  });

  it('reports on unknown filter chained with known filters', async () => {
    const sourceCode = `{{ "foo" | append: ".js" | bar }}`;
    const offenses = await runLiquidCheck(UnknownFilter, sourceCode);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe("Unknown filter 'bar' used.");

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql('| bar');
  });

  it('does not report on chain of known filters', async () => {
    const sourceCode = `{{ "foo" | append: ".js" | item_count_for_variant }}`;
    const offenses = await runLiquidCheck(UnknownFilter, sourceCode);
    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when a known filter is used (0)', async () => {
    const sourceCode = `{{ 'hello' | item_count_for_variant }}`;
    const offenses = await runLiquidCheck(UnknownFilter, sourceCode);
    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when a known filter is used (1)', async () => {
    const sourceCode = `{{ 'hello' | link_to_type }}`;
    const offenses = await runLiquidCheck(UnknownFilter, sourceCode);
    expect(offenses).toHaveLength(0);
  });

  it('should not report an offense when a known filter is used (2)', async () => {
    const sourceCode = `{{ 'hello' | link_to_vendor }}`;
    const offenses = await runLiquidCheck(UnknownFilter, sourceCode);
    expect(offenses).toHaveLength(0);
  });
});
