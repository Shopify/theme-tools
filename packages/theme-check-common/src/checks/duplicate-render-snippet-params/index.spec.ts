import { describe, it, expect, vi } from 'vitest';
import { DuplicateRenderSnippetParams } from '.';
import { runLiquidCheck, StringCorrector } from '../../test';

describe('DuplicateRenderSnippetParams', () => {
  function runCheck(sourceCode: string) {
    return runLiquidCheck(DuplicateRenderSnippetParams, sourceCode);
  }

  it('should report duplicate parameters in render tags', async () => {
    const sourceCode = `
      {% render 'snippet', param1: 'value1', param2: 'value2', param1: 'value3' %}
    `;

    const offenses = await runCheck(sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/Duplicate parameter 'param1'/);
    expect(offenses[0].suggest).toBeDefined();
    expect(offenses[0].suggest!.length).toBe(1);
    expect(offenses[0].suggest![0].message).toBe("Remove duplicate parameter 'param1'");
  });

  it('should report multiple duplicate parameters in render tags', async () => {
    const sourceCode = `
      {% render 'snippet', param1: 'value1', param2: 'value2', param1: 'value3', param2: 'value4' %}
    `;

    const offenses = await runCheck(sourceCode);

    expect(offenses).toHaveLength(2);
    expect(offenses[0].message).toMatch(/Duplicate parameter 'param1'/);
    expect(offenses[1].message).toMatch(/Duplicate parameter 'param2'/);
  });

  it('should not report when there are no duplicate parameters', async () => {
    const sourceCode = `
      {% render 'snippet', param1: 'value1', param2: 'value2', param3: 'value3' %}
    `;

    const offenses = await runCheck(sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should not report for variable render tags', async () => {
    const sourceCode = `
      {% render my_variable, param1: 'value1', param1: 'value2' %}
    `;

    const offenses = await runCheck(sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('should correctly fix duplicate parameters by removing the second occurrence', async () => {
    const sourceCode = `{% render 'snippet', param1: 'value1', param2: 'value2', param1: 'value3' %}`;
    const offenses = await runCheck(sourceCode);

    expect(offenses).toHaveLength(1);

    const fix = offenses[0].suggest![0].fix as (fixer: StringCorrector) => string;
    const fixer = {
      remove: vi.fn().mockReturnValue('fixed'),
    };

    fix(fixer as unknown as StringCorrector);

    expect(fixer.remove).toHaveBeenCalled();
    // The exact positions will depend on the parser, but we can verify it was called
  });

  it('should handle multiple occurrences of the same parameter', async () => {
    const sourceCode = `
      {% render 'snippet', param1: 'value1', param1: 'value2', param1: 'value3' %}
    `;

    const offenses = await runCheck(sourceCode);

    expect(offenses).toHaveLength(2);
    expect(offenses[0].message).toMatch(/Duplicate parameter 'param1'/);
    expect(offenses[1].message).toMatch(/Duplicate parameter 'param1'/);
  });

  it('should handle parameters with commas in different formats', async () => {
    const sourceCode = `
      {% render 'snippet', param1: 'value1',param2: 'value2',param1: 'value3' %}
    `;

    const offenses = await runCheck(sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/Duplicate parameter 'param1'/);
  });
});
