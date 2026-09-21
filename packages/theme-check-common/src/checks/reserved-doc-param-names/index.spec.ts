import { expect, describe, it } from 'vitest';
import { ReservedDocParamNames } from './index';
import { runLiquidCheck } from '../../test';

describe('Module: ReservedDocParamNames', () => {
  it.each(['blocks/file.liquid', 'snippets/file.liquid'])(
    'reports Liquid literal parameter names in %s',
    async (fileName) => {
      const sourceCode = `
          {% doc %}
            @param nil - Example param
            @param null - Example param
            @param true - Example param
            @param false - Example param
            @param blank - Example param
            @param empty - Example param
          {% enddoc %}
        `;

      const offenses = await runLiquidCheck(ReservedDocParamNames, sourceCode, fileName);

      expect(offenses).to.have.length(6);
      expect(offenses.map(({ message }) => message)).toEqual([
        "The parameter name 'nil' is reserved because Liquid parses it as a literal.",
        "The parameter name 'null' is reserved because Liquid parses it as a literal.",
        "The parameter name 'true' is reserved because Liquid parses it as a literal.",
        "The parameter name 'false' is reserved because Liquid parses it as a literal.",
        "The parameter name 'blank' is reserved because Liquid parses it as a literal.",
        "The parameter name 'empty' is reserved because Liquid parses it as a literal.",
      ]);
    },
  );

  it.each(['blocks/file.liquid', 'snippets/file.liquid'])(
    'allows non-literal parameter names in %s',
    async (fileName) => {
      const sourceCode = `
          {% doc %}
            @param param1 - Example param
            @param class - Example param
            @param attributes - Example param
            @param id - Example param
          {% enddoc %}
        `;

      const offenses = await runLiquidCheck(ReservedDocParamNames, sourceCode, fileName);

      expect(offenses).to.be.empty;
    },
  );
});
