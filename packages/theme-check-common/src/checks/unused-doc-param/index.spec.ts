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

  it.each([
    "{% assign style = 'default' %}{% include 'card' %}",
    "{% render 'card' %}{% assign style = 'default' %}{% include 'card' %}",
  ])('does not report parameters inherited by include callers: %s', async (caller) => {
    const offenses = await runLiquidCheck(
      UnusedDocParam,
      `{% doc %}
@param {string} [style] - Example style
{% enddoc %}{{ style }}`,
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
      { 'templates/product.liquid': caller },
    );

    expect(offenses).to.be.empty;
  });

  it('still reports unused parameters inside a snippet with an include caller', async () => {
    const offenses = await runLiquidCheck(
      UnusedDocParam,
      `{% doc %}
@param {string} [style] - Example style
{% enddoc %}`,
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
      { 'templates/product.liquid': "{% assign style = 'default' %}{% include 'card' %}" },
    );

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The parameter 'style' is defined but not used in this file.",
    );
  });

  it.each(["{% render 'card' %}", "{% include 'other' %}{% render 'card' %}"])(
    'reports a used parameter never passed to this snippet: %s',
    async (caller) => {
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
        { 'templates/product.liquid': caller },
      );

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        "The parameter 'style' is never passed to this snippet.",
      );
    },
  );

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

  it('should recognise parameters passed through render aliases and the default snippet name', async () => {
    const sourceCode = `
      {% doc %}
        @param {string} [item] - Rendered item
        @param {string} [card] - Default render variable
      {% enddoc %}

      {{ item }}
      {{ card }}
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
          {% render 'card' with product as item %}
          {% render 'card' for products as item %}
          {% render 'card' with product %}
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
