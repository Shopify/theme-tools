import { describe, it, expect } from 'vitest';
import { DuplicateRenderSnippetArguments } from '.';
import { runLiquidCheck, applySuggestions } from '../../test';

describe('Module: DuplicateRenderSnippetArguments', () => {
  function runCheck(sourceCode: string) {
    return runLiquidCheck(DuplicateRenderSnippetArguments, sourceCode);
  }

  describe('detection', () => {
    it('should report duplicate arguments in render tags', async () => {
      const sourceCode = `
        {% render 'snippet', param1: 'value1', param2: 'value2', param1: 'value3' %}
      `;

      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/Duplicate argument 'param1'/);
      expect(offenses[0].suggest).toBeDefined();
      expect(offenses[0].suggest!.length).toBe(1);
      expect(offenses[0].suggest![0].message).toBe("Remove duplicate argument 'param1'");
    });

    it('should report multiple duplicate arguments in render tags', async () => {
      const sourceCode = `
        {% render 'snippet', param1: 'value1', param2: 'value2', param1: 'value3', param2: 'value4', param1: 'value5' %}
      `;

      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(3);
      expect(offenses[0].message).toMatch(/Duplicate argument 'param1'/);
      expect(offenses[0].start.index).toBe(sourceCode.indexOf("param1: 'value3'"));
      expect(offenses[1].message).toMatch(/Duplicate argument 'param2'/);
      expect(offenses[1].start.index).toBe(sourceCode.indexOf("param2: 'value4'"));
      expect(offenses[2].message).toMatch(/Duplicate argument 'param1'/);
      expect(offenses[2].start.index).toBe(sourceCode.indexOf("param1: 'value5'"));
    });

    it('should not report when render tag is using `with/for` alias syntax', async () => {
      const sourceCode = `
        {% render 'snippet' with 'string' as param1, param1: 'value1' %}
      `;

      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/Duplicate argument 'param1'/);
    });
  });

  describe('suggestions', () => {
    it('should correctly suggest fixing all duplicate arguments except for the first', async () => {
      const sourceCode = `{% render 'snippet', param1: 'value1', param2: 'value2', param1: 'value3', param1: 'value4' %}`;
      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(2);
      expect(offenses[0].start.index).toBe(sourceCode.indexOf("param1: 'value3'"));
      expect(offenses[1].start.index).toBe(sourceCode.indexOf("param1: 'value4'"));
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([
        `{% render 'snippet', param1: 'value1', param2: 'value2', param1: 'value4' %}`,
      ]);
    });

    it('should suggest removing duplicates when with / for alias is used', async () => {
      const sourceCode = `{% render 'snippet' with 'string' as param2, param1: 'value1', param2: 'value2' %}`;
      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(1);
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([
        `{% render 'snippet' with 'string' as param2, param1: 'value1' %}`,
      ]);
    });
  });

  describe('edge cases', () => {
    it('should not report when there are no duplicate arguments', async () => {
      const sourceCode = `
        {% render 'snippet', param1: 'value1', param2: 'value2', param3: 'value3' %}
      `;

      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(0);
    });

    it('should not report for variable render tags where snippet name is a variable', async () => {
      const sourceCode = `
        {% render my_variable, param1: 'value1', param1: 'value2' %}
      `;

      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(0);
    });

    it('should handle remove duplicate param when there are multiple render tags', async () => {
      const sourceCode = `
        {% render 'snippet', param1: 'value1', param2: 'value2', param3: 'value3' %}
        {% render 'snippet', param1: 'value4', param2: 'value5', param1: 'value6' %}
       `;

      const offenses = await runCheck(sourceCode);

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toMatch(/Duplicate argument 'param1'/);
      expect(offenses[0].start.index).toBe(sourceCode.indexOf("param1: 'value6'"));
      const suggestionResult = applySuggestions(sourceCode, offenses[0]);
      expect(suggestionResult).toEqual([
        `
        {% render 'snippet', param1: 'value1', param2: 'value2', param3: 'value3' %}
        {% render 'snippet', param1: 'value4', param2: 'value5' %}
       `,
      ]);
    });
  });
});
