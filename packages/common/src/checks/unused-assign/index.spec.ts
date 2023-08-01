import { expect, describe, it } from 'vitest';
import { UnusedAssign } from './index';
import { runLiquidCheck, applySuggestions } from '../../test';

describe('Module: UnusedAssign', () => {
  it('should report an error when a variable is assigned but not used', async () => {
    const sourceCode = `
      {% assign unusedVar = "value" %}
      {% assign usedVar = "anotherValue" %}
      {{ usedVar }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal("The variable 'unusedVar' is assigned but not used");
  });

  it('should not report an error when a variable is assigned and used', async () => {
    const sourceCode = `
      {% assign usedVar = "value" %}
      {{ usedVar }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);

    expect(offenses).to.be.empty;
  });

  it('should provide a suggestion to remove the unused variable', async () => {
    const sourceCode = `
      {% assign unusedVar = "value" %}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].suggest).to.have.length(1);
    expect(offenses[0]!.suggest![0].message).to.equal("Remove the unused variable 'unusedVar'");
  });

  it('should fix the code by removing the unused variable', async () => {
    const sourceCode = `
      {% assign unusedVar = "value" %}
      {% assign usedVar = "anotherValue" %}
      {{ usedVar }}
    `;

    const offenses = await runLiquidCheck(UnusedAssign, sourceCode);
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    // We're not deleting the line, that's prettier's job.
    const expectedFixedCode = `
      ${''}
      {% assign usedVar = "anotherValue" %}
      {{ usedVar }}
    `;

    expect(suggestions).to.include(expectedFixedCode);
  });
});
