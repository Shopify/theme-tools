import { describe, it, expect } from 'vitest';
import { DuplicateBlockArguments } from './index';
import { runLiquidCheck } from '../../test';

const BUTTON_BLOCK = [
  '{% doc %}',
  '  @param {String} [variant] - Button variant',
  '  @param {String} [class] - Additional CSS classes',
  '  @param {String} [url] - Button URL',
  '{% enddoc %}',
  '<button>{{ block.content }}</button>',
].join('\n');

const NO_DOC_BLOCK = '<button>{{ block.content }}</button>';

describe('DuplicateBlockArguments', () => {
  it('reports duplicate argument', async () => {
    const offenses = await runLiquidCheck(
      DuplicateBlockArguments,
      "{% block 'button', variant: 'a', variant: 'b' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain('variant');
  });

  it('does not report unique arguments', async () => {
    const offenses = await runLiquidCheck(
      DuplicateBlockArguments,
      "{% block 'button', variant: 'a', class: 'b' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('reports duplicate even without a block file', async () => {
    const offenses = await runLiquidCheck(
      DuplicateBlockArguments,
      "{% block 'nonexistent', variant: 'a', variant: 'b' %}x{% endblock %}",
      'templates/test.liquid',
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain('variant');
  });

  it('reports duplicate even when block file has no doc tag', async () => {
    const offenses = await runLiquidCheck(
      DuplicateBlockArguments,
      "{% block 'button', variant: 'a', variant: 'b' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': NO_DOC_BLOCK },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain('variant');
  });
});
