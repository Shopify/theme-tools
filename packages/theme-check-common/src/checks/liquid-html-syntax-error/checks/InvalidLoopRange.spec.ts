import { expect, describe, it, vi, beforeEach } from 'vitest';
import { applyFix, runLiquidCheck } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';
import { toLiquidAST } from '@shopify/liquid-html-parser';
import { INVALID_LOOP_RANGE_MESSAGE } from './InvalidLoopRange';

vi.mock('@shopify/liquid-html-parser', async (importOriginal) => {
  const original: any = await importOriginal();

  return {
    ...original,

    // we will be mocked later on
    toLiquidAST: vi.fn().mockImplementation((source, options) => {
      return original.toLiquidAST(source, options);
    }),
  };
});

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

  it('should report when there are multiple instances of the error', async () => {
    const sourceCode = `{% for i in (1...10) %}{% endfor %} {% tablerow x in (a...b) %}{% endtablerow %}`;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.equal(INVALID_LOOP_RANGE_MESSAGE);
    expect(offenses[1].message).to.equal(INVALID_LOOP_RANGE_MESSAGE);

    expect(toLiquidAST).toHaveBeenCalledTimes(2);
    expect(toLiquidAST).toHaveBeenCalledWith(`{% for i in (1..10) %}{% endfor %}`, {
      allowUnclosedDocumentNode: false,
      mode: 'strict',
    });
    expect(toLiquidAST).toHaveBeenCalledWith(`{% tablerow x in (a..b) %}{% endtablerow %}`, {
      allowUnclosedDocumentNode: false,
      mode: 'strict',
    });

    const fixed = applyFix(sourceCode, offenses[0]);
    expect(fixed).to.equal(
      `{% for i in (1..10) %}{% endfor %} {% tablerow x in (a...b) %}{% endtablerow %}`,
    );

    const fixed2 = applyFix(sourceCode, offenses[1]);
    expect(fixed2).to.equal(
      `{% for i in (1...10) %}{% endfor %} {% tablerow x in (a..b) %}{% endtablerow %}`,
    );
  });

  it('should not report when the fixed code produces an invalid AST', async () => {
    const sourceCode = `{% for i in (1..10) %}{% endfor %}`;

    vi.mocked(toLiquidAST).mockImplementation((_source, _options) => {
      throw new SyntaxError('Invalid AST');
    });

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
