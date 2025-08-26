import { expect, describe, it, vi } from 'vitest';
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

describe('detectMultipleEchoValues', async () => {
  it('should not report when there are no trailing values', async () => {
    const testCases = [
      `{% echo '123' %}`,
      `{% echo '123' | upcase %}`,
      `{{ '123' }}`,
      `{{ '123' | upcase }}`,
    ];

    for (const sourceCode of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(0);
    }
  });

  it('should report when there are multiple values (no filters)', async () => {
    const testCases = [
      [`{% echo '123' 555 text %}`, "{% echo '123' %}"],
      [`{% echo "123" 555 text %}`, '{% echo "123" %}'],
      [`{% echo 123 555 text %}`, '{% echo 123 %}'],
      [`{% echo true 555 text %}`, '{% echo true %}'],
      [`{{ '123' 555 text }}`, `{{ '123' }}`],
      [`{{ "123" 555 text }}`, `{{ "123" }}`],
      [`{{ 123 555 text }}`, `{{ 123 }}`],
      [`{{ true 555 text }}`, `{{ true }}`],
    ];

    for (const [sourceCode, expected] of testCases) {
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal('Syntax is not supported');

      const fixed = applyFix(sourceCode, offenses[0]);
      expect(fixed).to.equal(expected);
    }
  });

  it('should report when there are multiple values (with filters)', async () => {
    const testCases = [
      [`{% echo '123' 555 text | upcase %}`, "{% echo '123' | upcase %}"],
      [`{% echo "123" 555 text | upcase %}`, '{% echo "123" | upcase %}'],
      [`{% echo 123 555 text | default: 0 %}`, '{% echo 123 | default: 0 %}'],
      [`{% echo true 555 text | fake-filter: 'yes' %}`, "{% echo true | fake-filter: 'yes' %}"],
      [`{{ '123' 555 text | upcase }}`, `{{ '123' | upcase }}`],
      [`{{ "123" 555 text | default: 0 }}`, `{{ "123" | default: 0 }}`],
      [`{{ 123 555 text | fake-filter: 'yes' }}`, `{{ 123 | fake-filter: 'yes' }}`],
      [`{{ true 555 text | fake-filter: 'yes' }}`, `{{ true | fake-filter: 'yes' }}`],
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
    const sourceCode = `{% echo '123' 555 text %}`;

    vi.mocked(toLiquidAST).mockImplementation((_source, _options) => {
      throw new SyntaxError('Invalid AST');
    });

    const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
    expect(offenses).to.have.length(0);
  });
});
