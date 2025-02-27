import { expect, describe, it } from 'vitest';
import { ValidDocParamNames } from './index';
import { runLiquidCheck } from '../../test';

describe('Module: ValidDocParamNames', () => {
  it(`should not report a warning when no doc params share names with global objects or liquid tags`, async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(ValidDocParamNames, sourceCode);

    expect(offenses).to.be.empty;
  });

  it('should report a warning when a doc param shares a name with global objects', async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
        @param when - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(ValidDocParamNames, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The parameter 'when' shares the same name with a liquid tag.",
    );
  });

  it('should report a warning when a doc param shares a name with a liquid tag', async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
        @param product - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(ValidDocParamNames, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      "The parameter 'product' shares the same name with a global liquid object.",
    );
  });
});
