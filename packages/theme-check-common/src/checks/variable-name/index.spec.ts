import { expect, describe, it } from 'vitest';
import { VariableName } from './index';
import { applySuggestions, runLiquidCheck } from '../../test';

describe('Module: VariableName', () => {
  it('should report an error when a variable is using wrong naming format', async () => {
    const sourceCode = `{% assign variableName = "value" %}`;

    const offenses = await runLiquidCheck(VariableName, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("The variable 'variableName' uses wrong naming format");
  });

  it('should not report an error when a variable is using correct format', async () => {
    const sourceCode = `{% assign variable_name = "value" %}`;

    const offenses = await runLiquidCheck(VariableName, sourceCode);

    expect(offenses).to.be.empty;
  });

  it('should provide a suggestion to change the variable naming', async () => {
    const sourceCode = `{% assign variableName = "value" %}`;

    const offenses = await runLiquidCheck(VariableName, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].suggest).to.have.length(1);
    expect(offenses[0]!.suggest![0].message).to.equal(
      "Change variable 'variableName' to 'variable_name'",
    );
  });

  it('should fix the code by changing the wrongly formatted variable', async () => {
    const sourceCode = `{% assign variableName = "value" %}`;

    const offenses = await runLiquidCheck(VariableName, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    const expectedFixedCode = `{% assign variable_name = "value" %}`;

    expect(suggestions).to.include(expectedFixedCode);
  });

  it('should report an error when a variable containing numbers uses wrong format', async () => {
    const sourceCode = `{% assign first_3_d_model = "value" %}`;

    const offenses = await runLiquidCheck(VariableName, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("The variable 'first_3_d_model' uses wrong naming format");
  });

  it('should not report an error when a variable containing numbers is using correct format', async () => {
    const sourceCode = `{% assign first_3d_model = "value" %}`;

    const offenses = await runLiquidCheck(VariableName, sourceCode);

    expect(offenses).to.be.empty;
  });
});
