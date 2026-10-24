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

  it('should report a used parameter that is never passed to the snippet', async () => {
    const sourceCode = `
      {% doc %}
        @param {string} [style] - Example style
      {% enddoc %}

      {{ style }}
    `;

    const offenses = await runLiquidCheck(
      UnusedDocParam,
      sourceCode,
      'snippets/card.liquid',
      {
        async getReferences() {
          return [
            {
              source: { uri: 'file:///templates/product.liquid' },
              target: { uri: 'file:///snippets/card.liquid' },
              type: 'direct',
            },
          ];
        },
      },
      { 'templates/product.liquid': "{% render 'card' %}" },
    );

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("The parameter 'style' is never passed to this snippet.");
  });

  it('should not report a used parameter that is passed to the snippet', async () => {
    const sourceCode = `
      {% doc %}
        @param {string} [style] - Example style
      {% enddoc %}

      {{ style }}
    `;

    const offenses = await runLiquidCheck(
      UnusedDocParam,
      sourceCode,
      'snippets/card.liquid',
      {
        async getReferences() {
          return [
            {
              source: { uri: 'file:///templates/product.liquid' },
              target: { uri: 'file:///snippets/card.liquid' },
              type: 'direct',
            },
          ];
        },
      },
      {
        'templates/product.liquid': `
          {% render 'card' %}
          {% render 'card', style: 'default' %}
        `,
      },
    );

    expect(offenses).to.be.empty;
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
