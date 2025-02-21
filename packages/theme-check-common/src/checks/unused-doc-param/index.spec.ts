import { expect, describe, it } from 'vitest';
import { UnusedDocParam } from './index';
import { runLiquidCheck, applySuggestions } from '../../test';
import { LoopNamedTags } from '@shopify/liquid-html-parser';

describe('Module: UnusedDocParam', () => {
  it('should not report a warning when a variable is defined and used', async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
      {% enddoc %}

      {{ param1 }}
    `;

    const offenses = await runLiquidCheck(UnusedDocParam, sourceCode);

    expect(offenses).to.be.empty;
  });

  it('should report a warning with suggestions when a variable is defined but not used', async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
        @param param2 - Example param
      {% enddoc %}

      {{ param1 }}
    `;

    const offenses = await runLiquidCheck(UnusedDocParam, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The parameter 'param2' is defined but not used in this file.",
    );
    expect(offenses[0].suggest).to.have.length(1);
    expect(offenses[0]!.suggest![0].message).to.equal("Remove unused parameter 'param2'");
  });

  it('should apply suggestion when a variable is defined but not used', async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
        @param param2 - Example param
      {% enddoc %}

      {{ param1 }}
    `;

    const offenses = await runLiquidCheck(UnusedDocParam, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).to.include(`
      {% doc %}
        @param param1 - Example param
        
      {% enddoc %}

      {{ param1 }}
    `);
  });

  LoopNamedTags.forEach((tag) => {
    it(`should report a warning when a variable is defined but not used outside '${tag}' loop context`, async () => {
      const sourceCode = `
        {% doc %}
          @param param1 - Example param
          @param param2 - Example param
        {% enddoc %}
  
        {{ param1 }}
        
        {% ${tag} param2 in array %}
          {{ param2 }}
        {% end${tag} %}
      `;

      const offenses = await runLiquidCheck(UnusedDocParam, sourceCode);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "The parameter 'param2' is defined but not used in this file.",
      );
      expect(offenses[0].suggest).to.have.length(1);
      expect(offenses[0]!.suggest![0].message).to.equal("Remove unused parameter 'param2'");
    });
  });
});
