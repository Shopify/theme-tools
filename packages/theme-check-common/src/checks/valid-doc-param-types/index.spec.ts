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

  it('should not report an error for a union of named types', async () => {
    const sourceCode = `
      {% doc %}
        @param {string|number} param1 - A string or number
      {% enddoc %}
    `;
    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should not report an error for a string literal type', async () => {
    const sourceCode = `
      {% doc %}
        @param {'banner'} param1 - Must be banner
      {% enddoc %}
    `;
    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should not report an error for a union of string literals', async () => {
    const sourceCode = `
      {% doc %}
        @param {'banner'|'label'} param1 - Either banner or label
      {% enddoc %}
    `;
    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should not report an error for a mixed union of named types and string literals', async () => {
    const sourceCode = `
      {% doc %}
        @param {string|'banner'|'label'} param1 - A string or specific value
      {% enddoc %}
    `;
    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);
    expect(offenses).to.be.empty;
  });

  it('should report an error when a union contains an invalid named type', async () => {
    const sourceCode = `
      {% doc %}
        @param {string|invalidType} param1 - Example param
      {% enddoc %}
    `;
    const offenses = await runLiquidCheck(ValidDocParamTypes, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The parameter type 'string|invalidType' is not supported.",
    );
  });
});
