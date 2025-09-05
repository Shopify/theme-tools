import { describe, it, expect } from 'vitest';
import { runLiquidCheck, applyFix } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';

describe('Module: InvalidFilterName', () => {
  describe('Alphanumeric and underscore trailing characters', () => {
    it('should not report on filters with alphanumeric trailing characters', async () => {
      const sourceCode = `{{ 'HELLO' | append123: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should not report on filters with underscore trailing characters', async () => {
      const sourceCode = `{{ 'HELLO' | append_test }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });
  });

  describe('Valid filters', () => {
    it('should not report on valid filter names', async () => {
      const sourceCode = `{{ 'hello' | append: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should not report on unknown filters (handled by UnknownFilter check)', async () => {
      const sourceCode = `{{ 'hello' | completely_unknown_filter: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });
  });

  describe('Special characters after filter name', () => {
    it('should detect and fix append with trailing @ character', async () => {
      const sourceCode = `{{ 'HELLO' | append@ }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toContain('append');
      expect(fixedCode).not.toContain('append@');
    });

    it('should detect and fix filter with space followed by characters', async () => {
      const sourceCode = `{{ 'HELLO' | append me: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toContain('append:');
      expect(fixedCode).not.toContain('append me:');
    });
  });

  describe('Filter combinations and chains', () => {
    it('should handle normal filter followed by filter with special characters', async () => {
      const sourceCode = `{{ 'test' | downcase | append@: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters '@'");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{{ 'test' | downcase | append: 'world' }}`);
    });

    it('should handle filter with special characters followed by normal filter', async () => {
      const sourceCode = `{{ 'test' | append!: 'hello' | upcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters '!'");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{{ 'test' | append: 'hello' | upcase }}`);
    });

    it('should handle two filters with special characters in a row', async () => {
      const sourceCode = `{{ 'test' | append@: 'hello' | upcase# }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].message).toContain("Filter 'append' has trailing characters '@'");
      expect(offenses[1].message).toContain("Filter 'upcase' has trailing characters '#'");

      expect(offenses[0].fix).toBeDefined();
      expect(offenses[1].fix).toBeDefined();

      // Test individual fixes
      const firstFixed = applyFix(sourceCode, offenses[0]);
      expect(firstFixed).toBe(`{{ 'test' | append: 'hello' | upcase# }}`);

      const secondFixed = applyFix(sourceCode, offenses[1]);
      expect(secondFixed).toBe(`{{ 'test' | append@: 'hello' | upcase }}`);
    });

    it('should handle filter with space and characters followed by normal filter', async () => {
      const sourceCode = `{{ 'test' | append xyz: 'hello' | upcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters ' xyz'");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{{ 'test' | append: 'hello' | upcase }}`);
    });
  });

  describe('Assign tag filters', () => {
    it('should detect and fix assign with trailing @ character', async () => {
      const sourceCode = `{% assign foo = 'HELLO' | append@ %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toContain('append');
      expect(fixedCode).not.toContain('append@');
    });

    it('should detect and fix assign with space followed by characters', async () => {
      const sourceCode = `{% assign bar = 'HELLO' | append me: 'world' %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toContain('append:');
      expect(fixedCode).not.toContain('append me:');
    });

    it('should handle assign with multiple filters with special characters', async () => {
      const sourceCode = `{% assign baz = 'test' | append@: 'hello' | upcase# %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].message).toContain("Filter 'append' has trailing characters '@'");
      expect(offenses[1].message).toContain("Filter 'upcase' has trailing characters '#'");

      expect(offenses[0].fix).toBeDefined();
      expect(offenses[1].fix).toBeDefined();
    });

    it('should not report on valid assign filters', async () => {
      const sourceCode = `{% assign valid = 'hello' | append: 'world' | upcase %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });
  });

  describe('Echo tag filters', () => {
    it('should detect and fix echo with trailing @ character', async () => {
      const sourceCode = `{% echo 'HELLO' | append@ %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toContain('append');
      expect(fixedCode).not.toContain('append@');
    });

    it('should detect and fix echo with space followed by characters', async () => {
      const sourceCode = `{% echo 'HELLO' | append me: 'world' %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters");
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toContain('append:');
      expect(fixedCode).not.toContain('append me:');
    });

    it('should handle echo with multiple filters with special characters', async () => {
      const sourceCode = `{% echo 'test' | append@: 'hello' | upcase# %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].message).toContain("Filter 'append' has trailing characters '@'");
      expect(offenses[1].message).toContain("Filter 'upcase' has trailing characters '#'");

      expect(offenses[0].fix).toBeDefined();
      expect(offenses[1].fix).toBeDefined();
    });

    it('should not report on valid echo filters', async () => {
      const sourceCode = `{% echo 'hello' | append: 'world' | upcase %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });
  });

  describe('Liquid tag filters', () => {
    it('should detect and fix assign in liquid tag with trailing characters', async () => {
      const sourceCode = `{% liquid
        assign foo = 'test' | append@: 'hello'
      %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters '@'");
      expect(offenses[0].fix).toBeDefined();
    });

    it('should detect and fix echo in liquid tag with trailing characters', async () => {
      const sourceCode = `{% liquid
        echo 'test' | append@: 'hello'
      %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Filter 'append' has trailing characters '@'");
      expect(offenses[0].fix).toBeDefined();
    });
  });
});
