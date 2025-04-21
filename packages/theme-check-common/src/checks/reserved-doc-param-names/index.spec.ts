import { expect, describe, it } from 'vitest';
import { ReservedDocParamNames } from './index';
import { runLiquidCheck } from '../../test';

describe('Module: ReservedDocParamNames', () => {
  describe('block file', () => {
    it(`should not report an error when no doc params share names with reserved content_for tag params`, async () => {
      const sourceCode = `
        {% doc %}
          @param param1 - Example param
        {% enddoc %}
      `;

      const offenses = await runLiquidCheck(
        ReservedDocParamNames,
        sourceCode,
        'blocks/file.liquid',
      );

      expect(offenses).to.be.empty;
    });

    it('should report an error when a doc param shares names with reserved content_for tag params', async () => {
      const sourceCode = `
        {% doc %}
          @param param1 - Example param
          @param id - Example param
        {% enddoc %}
      `;

      const offenses = await runLiquidCheck(
        ReservedDocParamNames,
        sourceCode,
        'blocks/file.liquid',
      );

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.contain(
        `The parameter name is not supported because it's a reserved argument for 'content_for' tags.`,
      );
    });
  });

  describe('snippet file', () => {
    it('should not report an error when a doc param shares names with reserved content_for tag params', async () => {
      const sourceCode = `
        {% doc %}
          @param param1 - Example param
          @param id - Example param
        {% enddoc %}
      `;

      const offenses = await runLiquidCheck(
        ReservedDocParamNames,
        sourceCode,
        'snippets/file.liquid',
      );

      expect(offenses).to.have.length(0);
    });
  });
});
