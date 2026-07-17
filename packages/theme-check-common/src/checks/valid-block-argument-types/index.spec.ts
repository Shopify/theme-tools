import { describe, it, expect } from 'vitest';
import { ValidBlockArgumentTypes } from './index';
import { runLiquidCheck } from '../../test';

const BUTTON_BLOCK = [
  '{% doc %}',
  '  @param {String} [variant] - Button variant',
  '  @param {String} [class] - Additional CSS classes',
  '  @param {String} [url] - Button URL',
  '  @param {Number} [count] - Item count',
  '{% enddoc %}',
  '<button>{{ block.content }}</button>',
].join('\n');

const NO_DOC_BLOCK = '<button>{{ block.content }}</button>';

describe('ValidBlockArgumentTypes', () => {
  it('reports type mismatch', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      "{% block 'button', variant: 42 %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain('variant');
    expect(offenses[0].message).toContain('String');
    expect(offenses[0].message).toContain('number');
  });

  it('does not report correct types', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      "{% block 'button', variant: 'primary' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not report variable lookups', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      "{% block 'button', variant: my_var %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not report when block file has no doc tag', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      "{% block 'button', variant: 42 %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': NO_DOC_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports type mismatch for a Number param', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      "{% block 'button', count: 'abc' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain('count');
    expect(offenses[0].message).toContain('Number');
    expect(offenses[0].message).toContain('string');
  });

  it('does not report when block file does not exist', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      "{% block 'missing', count: 42 %}x{% endblock %}",
      'templates/test.liquid',
    );

    expect(offenses).toHaveLength(0);
  });
});
