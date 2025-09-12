import { expect, describe, it, vi, beforeEach } from 'vitest';
import { applyFix, runLiquidCheck } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';
import { INVALID_LOOP_RANGE_MESSAGE } from './InvalidLoopRange';

describe('detectInvalidLoopRange', async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not report when range is valid', async () => {
    const testCases = [
      `{% for i in (1..10) %}{% endfor %}`,
      `{% tablerow x in (a..b) %}{% endtablerow %}`,
    ];

    for (const sourceCode of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(0);
    }
  });

  it('should report when there is an extra `.` character in range', async () => {
    const testCases = [
      [`{% for i in (1...10) %}{% endfor %}`, '{% for i in (1..10) %}{% endfor %}'],
      [
        `{% tablerow x in (a...b) %}{% endtablerow %}`,
        '{% tablerow x in (a..b) %}{% endtablerow %}',
      ],
      [
        `{% tablerow x in (a .. b) %}{% endtablerow %}`,
        '{% tablerow x in (a..b) %}{% endtablerow %}',
      ],
      [
        `{% tablerow x in ( a..b ) %}{% endtablerow %}`,
        '{% tablerow x in (a..b) %}{% endtablerow %}',
      ],
    ];

    for (const [sourceCode, expected] of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(INVALID_LOOP_RANGE_MESSAGE);

      const fixed = applyFix(sourceCode, offenses[0]);
      expect(fixed).to.equal(expected);
    }
  });

  it('should report when the range contains a real number', async () => {
    const sourceCode = `{% for i in (-2.9..2.9) %}{% endfor %}`;
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(INVALID_LOOP_RANGE_MESSAGE);

    const fixed = applyFix(sourceCode, offenses[0]);
    expect(fixed).to.equal(`{% for i in (-2..2) %}{% endfor %}`);
  });

  it('should report when the range contains a nested variable', async () => {
    const sourceCode = `{% for i in (some.var..some.other.var) %}{% endfor %}`;
    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(0);
  });

  it('should report when there are multiple instances of the error', async () => {
    const sourceCode = `{% for i in (1...10) %}{% endfor %} {% tablerow x in (a...b) %}{% endtablerow %}`;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.equal(INVALID_LOOP_RANGE_MESSAGE);
    expect(offenses[1].message).to.equal(INVALID_LOOP_RANGE_MESSAGE);

    const fixed = applyFix(sourceCode, offenses[0]);
    expect(fixed).to.equal(
      `{% for i in (1..10) %}{% endfor %} {% tablerow x in (a...b) %}{% endtablerow %}`,
    );

    const fixed2 = applyFix(sourceCode, offenses[1]);
    expect(fixed2).to.equal(
      `{% for i in (1...10) %}{% endfor %} {% tablerow x in (a..b) %}{% endtablerow %}`,
    );
  });
});
