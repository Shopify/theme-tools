import { expect, describe, it, vi, beforeEach } from 'vitest';
import { applyFix, runLiquidCheck } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';
import { toLiquidAST } from '@shopify/liquid-html-parser';

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

describe('detectMultipleAssignValues', async () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not report when there are no trailing values', async () => {
    const testCases = [`{% assign foo = '123' %}`, `{% assign foo = '123' | upcase %}`];

    for (const sourceCode of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(0);
    }
  });

  it('should report when there are multiple values (no filters)', async () => {
    const testCases = [
      [`{% assign foo = '123' 555 text %}`, "{% assign foo = '123' %}"],
      [`{% assign foo = "123" 555 text %}`, '{% assign foo = "123" %}'],
      [`{% assign foo = 123 555 text %}`, '{% assign foo = 123 %}'],
      [`{% assign foo = true 555 text %}`, '{% assign foo = true %}'],
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
    const sourceCode = `{% assign foo = blank %} {% assign foo = '123' 555 text %} {% assign foo = '123' 555 text %}`;

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.equal('Syntax is not supported');
    expect(offenses[1].message).to.equal('Syntax is not supported');

    expect(toLiquidAST).toHaveBeenCalledTimes(2);
    expect(toLiquidAST).toHaveBeenCalledWith(`{% assign foo = '123' %}`, {
      allowUnclosedDocumentNode: false,
      mode: 'tolerant',
    });

    const fixed = applyFix(sourceCode, offenses[0]);
    expect(fixed).to.equal(
      `{% assign foo = blank %} {% assign foo = '123' %} {% assign foo = '123' 555 text %}`,
    );

    const fixed2 = applyFix(sourceCode, offenses[1]);
    expect(fixed2).to.equal(
      `{% assign foo = blank %} {% assign foo = '123' 555 text %} {% assign foo = '123' %}`,
    );
  });

  it('should report when there are multiple values (with filters)', async () => {
    const testCases = [
      [`{% assign foo = '123' 555 text | upcase %}`, "{% assign foo = '123' | upcase %}"],
      [`{% assign foo = "123" 555 text | upcase %}`, '{% assign foo = "123" | upcase %}'],
      [`{% assign foo = 123 555 text | default: 0 %}`, '{% assign foo = 123 | default: 0 %}'],
      [
        `{% assign foo = true 555 text | fake-filter: 'yes' %}`,
        "{% assign foo = true | fake-filter: 'yes' %}",
      ],
    ];

    for (const [sourceCode, expected] of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal('Syntax is not supported');

      const fixed = applyFix(sourceCode, offenses[0]);
      expect(fixed).to.equal(expected);
    }
  });

  it('should not report when the fixed code produces an invalid AST', async () => {
    const sourceCode = `{% assign foo = '123' 555 text %}`;

    vi.mocked(toLiquidAST).mockImplementation((_source, _options) => {
      throw new SyntaxError('Invalid AST');
    });

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
