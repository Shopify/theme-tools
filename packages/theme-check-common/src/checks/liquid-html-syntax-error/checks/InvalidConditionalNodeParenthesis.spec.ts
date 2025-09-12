import { expect, describe, it } from 'vitest';
import { applyFix, runLiquidCheck } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';

describe('detectConditionalNodeUnsupportedParenthesis', async () => {
  it('should not report no unsupported parenthesis in the markup', async () => {
    const testCases = [`{% if condition %}{% endif %}`, `{% if range == (1..2) %}{% endif %}`];

    for (const sourceCode of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(0);
    }
  });

  it('should report when there are unsupported parenthesis in the markup', async () => {
    const testCases = [
      [
        `{% if (this and that) or other %}{% endif %}`,
        '{% if this and that or other %}{% endif %}',
      ],
      [`{% if (a > b) and (c == d) %}{% endif %}`, '{% if a > b and c == d %}{% endif %}'],
    ];

    for (const [sourceCode, expected] of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal('Syntax is not supported');

      const fixed = applyFix(sourceCode, offenses[0]);
      expect(fixed).to.equal(expected);
    }
  });

  it('should report when there are multiple instances of the error', async () => {
    const sourceCode = `{% if (a or c) %}{% endif %} {% if (a == b) %}{% endif %} {% if condition %}{% endif %}`;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.equal('Syntax is not supported');
    expect(offenses[1].message).to.equal('Syntax is not supported');

    const fixed = applyFix(sourceCode, offenses[0]);
    expect(fixed).to.equal(
      `{% if a or c %}{% endif %} {% if (a == b) %}{% endif %} {% if condition %}{% endif %}`,
    );

    const fixed2 = applyFix(sourceCode, offenses[1]);
    expect(fixed2).to.equal(
      `{% if (a or c) %}{% endif %} {% if a == b %}{% endif %} {% if condition %}{% endif %}`,
    );
  });
});
