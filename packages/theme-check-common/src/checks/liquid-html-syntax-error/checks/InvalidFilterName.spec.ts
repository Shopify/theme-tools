import { describe, it, expect } from 'vitest';
import { runLiquidCheck, applyFix } from '../../../test';
import { LiquidHTMLSyntaxError } from '../index';

describe('Module: InvalidFilterName', () => {
  describe('Numbers and letters after filter name', () => {
    it('should detect append with numbers and suggest fix', async () => {
      const sourceCode = `{{ 'HELLO' | append123: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain(
        "Syntax is not supported: Filter 'append123' is not being activated because of trailing characters '123'. The filter will be ignored.",
      );

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'HELLO' }}`);
    });

    it('should detect append with letters and suggest fix', async () => {
      const sourceCode = `{{ 'HELLO' | appendme: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain(
        "Syntax is not supported: Filter 'appendme' is not being activated because of trailing characters 'me'. The filter will be ignored.",
      );

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'HELLO' }}`);
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

  describe('Multiple filters in chains', () => {
    it('should detect two bad filters in a row', async () => {
      const sourceCode = `{{ 'test' | append123: 'world' | color_to_rgb456 }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].message).toContain("Filter 'append123' is not being activated");
      expect(offenses[1].message).toContain("Filter 'color_to_rgb456' is not being activated");

      // Apply first fix
      const firstFixedCode = applyFix(sourceCode, offenses[0]);
      expect(firstFixedCode).toEqual(`{{ 'test' | color_to_rgb456 }}`);

      // Apply second fix
      const secondFixedCode = applyFix(sourceCode, offenses[1]);
      expect(secondFixedCode).toEqual(`{{ 'test' | append123: 'world' }}`);
    });

    it('should detect bad filter followed by good filter', async () => {
      const sourceCode = `{{ 'test' | append123: 'world' | color_to_rgb }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);

      expect(offenses[0].message).toContain("Filter 'append123' is not being activated");

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'test' | color_to_rgb }}`);
    });

    it('should detect good filter followed by bad filter', async () => {
      const sourceCode = `{{ 'test' | append: 'world' | color_to_rgb123 }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);

      expect(offenses[0].message).toContain("Filter 'color_to_rgb123' is not being activated");

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'test' | append: 'world' }}`);
    });

    it('should handle complex chain: good -> bad -> good -> bad', async () => {
      const sourceCode = `{{ 'test' | append: 'world' | color_to_rgb123 | item_count_for_variant | link_to_type456 }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].message).toContain("Filter 'color_to_rgb123' is not being activated");
      expect(offenses[1].message).toContain("Filter 'link_to_type456' is not being activated");

      // Apply first fix (remove color_to_rgb123)
      const firstFixedCode = applyFix(sourceCode, offenses[0]);
      expect(firstFixedCode).toEqual(
        `{{ 'test' | append: 'world' | item_count_for_variant | link_to_type456 }}`,
      );

      // Apply second fix (remove link_to_type456)
      const secondFixedCode = applyFix(sourceCode, offenses[1]);
      expect(secondFixedCode).toEqual(
        `{{ 'test' | append: 'world' | color_to_rgb123 | item_count_for_variant }}`,
      );
    });

    it('should handle three bad filters in a row', async () => {
      const sourceCode = `{{ 'test' | append123 | color_to_rgb456 | item_count_for_variantabc }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(3);

      expect(offenses[0].message).toContain("Filter 'append123' is not being activated");
      expect(offenses[1].message).toContain("Filter 'color_to_rgb456' is not being activated");
      expect(offenses[2].message).toContain(
        "Filter 'item_count_for_variantabc' is not being activated",
      );

      // Apply fixes individually to original source
      const firstFixedCode = applyFix(sourceCode, offenses[0]);
      expect(firstFixedCode).toEqual(`{{ 'test' | color_to_rgb456 | item_count_for_variantabc }}`);

      const secondFixedCode = applyFix(sourceCode, offenses[1]);
      expect(secondFixedCode).toEqual(`{{ 'test' | append123 | item_count_for_variantabc }}`);

      const thirdFixedCode = applyFix(sourceCode, offenses[2]);
      expect(thirdFixedCode).toEqual(`{{ 'test' | append123 | color_to_rgb456 }}`);
    });

    it('should handle mixed alphanumeric types in bad filters', async () => {
      const sourceCode = `{{ 'test' | append123: 'mixed' | color_to_rgbABC | link_to_type999xyz }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(3);

      expect(offenses[0].message).toContain(
        "Filter 'append123' is not being activated because of trailing characters '123'",
      );
      expect(offenses[1].message).toContain(
        "Filter 'color_to_rgbABC' is not being activated because of trailing characters 'ABC'",
      );
      expect(offenses[2].message).toContain(
        "Filter 'link_to_type999xyz' is not being activated because of trailing characters '999xyz'",
      );

      // Test individual fixes
      const firstFixedCode = applyFix(sourceCode, offenses[0]);
      expect(firstFixedCode).toEqual(`{{ 'test' | color_to_rgbABC | link_to_type999xyz }}`);

      const secondFixedCode = applyFix(sourceCode, offenses[1]);
      expect(secondFixedCode).toEqual(`{{ 'test' | append123: 'mixed' | link_to_type999xyz }}`);

      const thirdFixedCode = applyFix(sourceCode, offenses[2]);
      expect(thirdFixedCode).toEqual(`{{ 'test' | append123: 'mixed' | color_to_rgbABC }}`);
    });

    it('should only detect bad filters in alternating pattern', async () => {
      const sourceCode = `{{ 'test' | appendXYZ | append: 'good' | color_to_rgb123 | color_to_rgb }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].message).toContain("Filter 'appendXYZ' is not being activated");
      expect(offenses[1].message).toContain("Filter 'color_to_rgb123' is not being activated");

      const firstFixedCode = applyFix(sourceCode, offenses[0]);
      expect(firstFixedCode).toEqual(
        `{{ 'test' | append: 'good' | color_to_rgb123 | color_to_rgb }}`,
      );

      const secondFixedCode = applyFix(sourceCode, offenses[1]);
      expect(secondFixedCode).toEqual(`{{ 'test' | appendXYZ | append: 'good' | color_to_rgb }}`);
    });

    it('should handle bad filter at the beginning of long chain', async () => {
      const sourceCode = `{{ 'test' | append999 | append: 'step2' | color_to_rgb | item_count_for_variant }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);

      expect(offenses[0].message).toContain("Filter 'append999' is not being activated");

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(
        `{{ 'test' | append: 'step2' | color_to_rgb | item_count_for_variant }}`,
      );
    });

    it('should handle a bad filter in the middle of a long chain', async () => {
      const sourceCode = `{{ 'test' | append: 'step1' | color_to_rgb666 | item_count_for_variant | link_to_type }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);

      expect(offenses[0].message).toContain("Filter 'color_to_rgb666' is not being activated");

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(
        `{{ 'test' | append: 'step1' | item_count_for_variant | link_to_type }}`,
      );
    });
  });

  describe('Fix functionality', () => {
    it('should fix numeric characters by removing the entire filter', async () => {
      const sourceCode = `{{ 'HELLO' | append123: 'world' }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'HELLO' }}`);
    });

    it('should fix alphabetic letters by removing the entire filter', async () => {
      const sourceCode = `{{ 'HELLO' | appendme }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'HELLO' }}`);
    });

    it('should fix filter with trailing parameters correctly', async () => {
      const sourceCode = `{{ 'test' | append123: 'world' | color_to_rgb }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'test' | color_to_rgb }}`);
    });

    it('should fix filter at the end of chain correctly', async () => {
      const sourceCode = `{{ 'test' | append: 'world' | color_to_rgb123 }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'test' | append: 'world' }}`);
    });

    it('should fix individual bad filters in multiple filter chains', async () => {
      const sourceCode = `{{ 'test' | append123: 'world' | color_to_rgb456 }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(2);

      expect(offenses[0].fix).toBeDefined();
      expect(offenses[1].fix).toBeDefined();

      const firstFixedCode = applyFix(sourceCode, offenses[0]);
      expect(firstFixedCode).toEqual(`{{ 'test' | color_to_rgb456 }}`);

      const secondFixedCode = applyFix(sourceCode, offenses[1]);
      expect(secondFixedCode).toEqual(`{{ 'test' | append123: 'world' }}`);
    });

    it('should handle fix in an alternating chain of filters', async () => {
      const sourceCode = `{{ 'test' | append: 'good' | color_to_rgb123 | item_count_for_variant }}`;
      const offenses = await runLiquidCheck(LiquidHTMLSyntaxError, sourceCode);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].fix).toBeDefined();

      const fixedCode = applyFix(sourceCode, offenses[0]);
      expect(fixedCode).toEqual(`{{ 'test' | append: 'good' | item_count_for_variant }}`);
    });
  });
});
