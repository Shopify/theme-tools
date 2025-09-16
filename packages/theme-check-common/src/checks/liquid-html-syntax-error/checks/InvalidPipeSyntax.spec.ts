import { describe, it, expect } from 'vitest';
import { runLiquidCheck, applyFix } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';

describe('Module: InvalidPipeSyntax', () => {
  describe('Double pipe patterns', () => {
    it('should detect and fix double pipes in variable output', async () => {
      const sourceCode = `{{ 'hello' | upcase | | downcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{{ 'hello' | upcase | downcase }}`);
    });

    it('should detect and fix double pipes with extra whitespace', async () => {
      const sourceCode = `{{ 'hello' | upcase |   | downcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{{ 'hello' | upcase | downcase }}`);
    });

    it('should detect and fix double pipes in assign tag', async () => {
      const sourceCode = `{% assign result = 'hello' | upcase | | downcase %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{% assign result = 'hello' | upcase | downcase %}`);
    });

    it('should detect and fix double pipes in echo tag', async () => {
      const sourceCode = `{% echo 'hello' | upcase | | downcase %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{% echo 'hello' | upcase | downcase %}`);
    });

    it('should handle multiple double pipes in one expression', async () => {
      const sourceCode = `{{ 'hello' | upcase | | downcase | | reverse }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      expect(offenses[1].message).toContain('Remove extra `|` character(s)');

      expect(offenses[0].fix).toBeDefined();
      expect(offenses[1].fix).toBeDefined();
    });
  });

  describe('Trailing pipe patterns', () => {
    it('should detect and fix trailing pipe in variable output', async () => {
      const sourceCode = `{{ 'hello' | upcase | }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain('Remove the trailing `|` character');
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{{ 'hello' | upcase }}`);
    });

    it('should detect and fix trailing pipe in assign tag', async () => {
      const sourceCode = `{% assign result = 'hello' | upcase | %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain('Remove the trailing `|` character');
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{% assign result = 'hello' | upcase %}`);
    });

    it('should detect and fix trailing pipe in echo tag', async () => {
      const sourceCode = `{% echo 'hello' | upcase | %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain('Remove the trailing `|` character');
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toBe(`{% echo 'hello' | upcase %}`);
    });

    it('should detect and fix multiple trailing pipes', async () => {
      const sourceCode = `{{ 'hello' | upcase | | }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2); // Double pipe AND trailing pipe
      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      expect(offenses[1].message).toContain('Remove the trailing `|` character');
      expect(offenses[0].fix).toBeDefined();
      expect(offenses[1].fix).toBeDefined();
    });
  });

  describe('Complex pipe scenarios', () => {
    it('should handle mixed valid and invalid pipes', async () => {
      const sourceCode = `{{ 'hello' | upcase | | downcase | reverse | }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      // First should be double pipe
      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      // Second should be trailing pipe
      expect(offenses[1].message).toContain('Remove the trailing `|` character');
    });

    it('should not interfere with valid filter parameter syntax', async () => {
      const sourceCode = `{{ 'hello' | append: 'world' | upcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should handle liquid tag with mixed pipe issues', async () => {
      const sourceCode = `{% liquid
        assign foo = 'test' | upcase | | downcase |
        echo bar | reverse
      %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);
      expect(offenses[0].message).toContain('Remove extra `|` character(s)');
      expect(offenses[1].message).toContain('Remove the trailing `|` character');
    });
  });

  describe('Valid syntax should not be flagged', () => {
    it('should not report on valid filter chains', async () => {
      const sourceCode = `{{ 'hello' | upcase | append: 'world' | downcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should not report on simple filters', async () => {
      const sourceCode = `{{ 'hello' | upcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should not report on filters with arguments', async () => {
      const sourceCode = `{{ product.title | append: ' - ' | append: shop.name }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should not report on valid assign with filters', async () => {
      const sourceCode = `{% assign title = product.title | upcase | truncate: 50 %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should not report on valid echo with filters', async () => {
      const sourceCode = `{% echo product.title | upcase | truncate: 50 %}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle pipes in string literals correctly', async () => {
      const sourceCode = `{{ 'hello | world' | upcase }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });

    it('should not report on conditional expressions with pipes', async () => {
      const sourceCode = `{{ product.title | default: 'No title' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(0);
    });
  });
});
