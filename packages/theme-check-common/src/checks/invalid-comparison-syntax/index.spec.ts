import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { InvalidComparisonSyntax } from './index';

describe('Module: InvalidComparisonSyntax', () => {
  it('should report an offense an invalid token is used', async () => {
    const sourceCode = `
      {% if a > b foobar %}
      {% endif %}
    `;
    const offenses = await runLiquidCheck(InvalidComparisonSyntax, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toEqual(`Invalid token 'foobar' after comparison`);
  });

  it('should suggest removing the invalid token', async () => {
    const sourceCode = `
      {% if a > b foobar %}
      {% endif %}
    `;
    const offenses = await runLiquidCheck(InvalidComparisonSyntax, sourceCode);

    expect(offenses).toHaveLength(1);

    expect(offenses[0]!.suggest![0]!.message).toEqual(`Remove 'foobar'`);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toBe('foobar');
  });
});
