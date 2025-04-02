import { expect, describe, it } from 'vitest';
import { UniqueDocParamNames } from './index';
import { runLiquidCheck } from '../../test';

describe('Module: UniqueDocParamNames', () => {
  it(`should not report an error when a all doc params have unique names`, async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
        @param param2 - Example param
        @param param3 - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(UniqueDocParamNames, sourceCode);

    expect(offenses).to.be.empty;
  });

  it('should report an error when a param name appears more than once', async () => {
    const sourceCode = `
      {% doc %}
        @param param1 - Example param
        @param param1 - Example param
        @param param1 - Example param
      {% enddoc %}
    `;

    const offenses = await runLiquidCheck(UniqueDocParamNames, sourceCode);

    expect(offenses).to.have.length(2);
    expect(offenses[0].message).to.equal("The parameter 'param1' is defined more than once.");
    expect(offenses[1].message).to.equal("The parameter 'param1' is defined more than once.");
  });
});
