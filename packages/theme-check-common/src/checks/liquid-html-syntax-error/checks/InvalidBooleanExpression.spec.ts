import { describe, expect, it } from 'vitest';
import { applyFix, runLiquidCheck } from '../../../test';
import { LiquidHTMLSyntaxError } from '..';

describe('detectTrailingAssignValue', async () => {
  it('should not report when there are no trailing values', async () => {
    const testCases = [`{% assign foo = '123' %}`, `{% assign foo = '123' | upcase %}`];

    for (const sourceCode of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(0);
    }
  });

  it('should not report when the boolean expression is in a schema tag', async () => {
    const sourceCode = `{% schema %}
      {
        "visible_if": "{{ this > that }}"
      }
    {% endschema %}`;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(0);
  });

  it('should report all use of boolean expressions', async () => {
    const testCases = [
      [`{% assign foo = something == else %}`, '{% assign foo = something %}'],
      [`{% echo foo != bar %}`, '{% echo foo %}'],
      [`{{ this > that }}`, '{{ this }}'],
      [`{{ bool and cond }}`, '{{ bool}}'],
    ];

    for (const [sourceCode, expected] of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal('Syntax is not supported');

      const fixed = applyFix(sourceCode, offenses[0]);
      expect(fixed).to.equal(expected);
    }
  });
});
