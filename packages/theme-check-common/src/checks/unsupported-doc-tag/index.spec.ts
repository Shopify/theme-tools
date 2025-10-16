import { expect, describe, it } from 'vitest';
import { UnsupportedDocTag } from './index';
import { runLiquidCheck, applySuggestions } from '../../test';

describe('Module: UnsupportedDocTag', () => {
  const sourceCode = `{% doc %} @param param1 - Example param {% enddoc %}{{ 'hello' }}`;

  it('should report an error when `doc` tag is used outside snippets', async () => {
    const offenses = await runLiquidCheck(
      UnsupportedDocTag,
      sourceCode,
      'file://sections/file.liquid',
    );

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'The `doc` must be placed directly within an inline snippet tag, not nested inside other tags',
    );
  });

  it('should apply suggestion when `doc` tag is used outside snippets', async () => {
    const offenses = await runLiquidCheck(
      UnsupportedDocTag,
      sourceCode,
      'file://sections/file.liquid',
    );

    expect(offenses).to.have.length(1);
    expect(offenses[0].suggest).to.have.length(1);
    expect(offenses[0]!.suggest![0].message).to.equal('Remove unsupported `doc` tag');
    const suggestions = applySuggestions(sourceCode, offenses[0]);

    expect(suggestions).to.include(`{{ 'hello' }}`);
  });

  it('should not report an error when `doc` tag is used within snippets', async () => {
    const offenses = await runLiquidCheck(
      UnsupportedDocTag,
      sourceCode,
      'file://snippets/file.liquid',
    );

    expect(offenses).to.be.empty;
  });

  it('should not report an error when `doc` tag is used inside inline snippet', async () => {
    const layoutSourceCode = `
      {% snippet %}
        ${sourceCode}
      {% endsnippet %}
    `;

    const offenses = await runLiquidCheck(
      UnsupportedDocTag,
      layoutSourceCode,
      'file://layout/theme.liquid',
    );

    expect(offenses).to.be.empty;
  });

  it('should report an error when `doc` tag is nested inside a block within a snippet file', async () => {
    const nestedSourceCode = `
      {% if true %}
        ${sourceCode}
      {% endif %}
    `;

    const offenses = await runLiquidCheck(
      UnsupportedDocTag,
      nestedSourceCode,
      'file://snippets/file.liquid',
    );

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'The `doc` tag must be a top-level tag within a snippet/block file',
    );
  });
});
