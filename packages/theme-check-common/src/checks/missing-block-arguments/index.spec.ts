import { describe, it, expect } from 'vitest';
import { MissingBlockArguments } from './index';
import { runLiquidCheck } from '../../test';

const CARD_BLOCK = [
  '{% doc %}',
  '  @param {String} title - Card title',
  '  @param {String} [subtitle] - Card subtitle',
  '{% enddoc %}',
  '<div>{{ title }}</div>',
].join('\n');

const NO_DOC_BLOCK = '<button>{{ block.content }}</button>';

describe('MissingBlockArguments', () => {
  it('reports when required param is missing', async () => {
    const offenses = await runLiquidCheck(
      MissingBlockArguments,
      "{% block 'card', subtitle: 'sub' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/card.liquid': CARD_BLOCK },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain('title');
  });

  it('does not report when required param is provided', async () => {
    const offenses = await runLiquidCheck(
      MissingBlockArguments,
      "{% block 'card', title: 'Hello' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/card.liquid': CARD_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not report when block file has no doc tag', async () => {
    const offenses = await runLiquidCheck(
      MissingBlockArguments,
      "{% block 'card' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/card.liquid': NO_DOC_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not report when block file does not exist', async () => {
    const offenses = await runLiquidCheck(
      MissingBlockArguments,
      "{% block 'missing' %}x{% endblock %}",
      'templates/test.liquid',
    );

    expect(offenses).toHaveLength(0);
  });
});
