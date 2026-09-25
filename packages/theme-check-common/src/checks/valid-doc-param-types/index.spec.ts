import { expect, describe, it } from 'vitest';
import { ValidDocParamTypes } from './index';
import { runLiquidCheck, applySuggestions } from '../../test';
import { BasicParamTypes } from '../../liquid-doc/utils';

describe('Module: ValidDocParamTypes', () => {
  Object.values(BasicParamTypes).forEach((paramType) => {
    it(`should not report an error when a valid basic parameter (${paramType}) type is used`, async () => {
      const sourceCode = `
        {% doc %}
          @param {${paramType}} param1 - Example param
        {% enddoc %}
      `;

      const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);

      expect(offenses).to.be.empty;
    });
  });

  it(`should not report an error when a valid liquid object parameter (product) type is used`, async () => {
    const sourceCode = `
      {% doc %}
        @param {product} param1 - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);

    expect(offenses).to.be.empty;
  });

  it(`should not report an error when a valid liquid object array parameter (product[]) type is used`, async () => {
    const sourceCode = `
      {% doc %}
        @param {product[]} param1 - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);

    expect(offenses).to.be.empty;
  });

  it.each([
    "'heading' | 'small'",
    '"Heading"|"small"',
    "'heading'",
    "'' | ' small '",
    "'a|b' | 'a}b'",
    `"it's" | 'say "hi"'`,
  ])('accepts the string enum {%s}', async (type) => {
    const source = `{% doc %}\n  @param {${type}} [variant] - Text style\n{% enddoc %}`;
    expect(await runLiquidCheck(ValidDocParamTypes, source)).toHaveLength(0);
  });

  it.each([
    "'heading' |",
    "| 'heading'",
    "'heading' || 'small'",
    "'heading' 'small'",
    "'heading' | small",
    "'heading' | 'small",
    "'heading' | number",
    'heading | small',
    '1 | 2',
    'true | false',
    "('heading' | 'small')",
    "'heading'[]",
  ])(
    'reports the complete invalid enum {%s} and preserves the optional parameter in its fix',
    async (type) => {
      const source = `{% doc %}\n  @param   { ${type} }   [variant] - Text style\n{% enddoc %}`;
      const offenses = await runLiquidCheck(ValidDocParamTypes, source);
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(`The parameter type ' ${type} ' is not supported.`);
      expect(source.slice(offenses[0].start.index, offenses[0].end.index)).toBe(`{ ${type} }`);
      expect(applySuggestions(source, offenses[0])).toEqual([
        '{% doc %}\n  @param [variant] - Text style\n{% enddoc %}',
      ]);
    },
  );

  it('should report an error with suggestions when an invalid parameter type is used', async () => {
    const sourceCode = `
      {% doc %}
        @param {invalidType} param1 - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("The parameter type 'invalidType' is not supported.");
    expect(offenses[0].suggest).to.have.length(1);
    expect(offenses[0]!.suggest![0].message).to.equal('Remove invalid parameter type');
  });

  it('should apply suggestion when an invalid parameter type is used', async () => {
    const sources = [
      `{% doc %} @param {invalidType} param1 - Example param {% enddoc %}`,
      `{% doc %} @param   {   invalidType   }   param1 - Example param {% enddoc %}`,
    ];

    for (const source of sources) {
      const offenses = await runLiquidCheck(ValidDocParamTypes, source);

      expect(offenses).to.have.length(1);
      const suggestions = applySuggestions(source, offenses[0]);

      expect(suggestions).to.include(`{% doc %} @param param1 - Example param {% enddoc %}`);
    }
  });
});
