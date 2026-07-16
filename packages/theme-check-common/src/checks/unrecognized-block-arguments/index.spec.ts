import { describe, it, expect } from 'vitest';
import { UnrecognizedBlockArguments } from './index';
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

describe('UnrecognizedBlockArguments', () => {
  it('reports unknown argument', async () => {
    const offenses = await runLiquidCheck(
      UnrecognizedBlockArguments,
      "{% block 'button', variant: 'primary', size: 'large' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain('size');
  });

  it('does not report known arguments', async () => {
    const offenses = await runLiquidCheck(
      UnrecognizedBlockArguments,
      "{% block 'button', variant: 'primary', class: 'mb-2' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not report system arguments', async () => {
    const offenses = await runLiquidCheck(
      UnrecognizedBlockArguments,
      "{% block 'button', block.settings.variant: 'xl', block.content: content %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': BUTTON_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not report when block file has no doc tag', async () => {
    const offenses = await runLiquidCheck(
      UnrecognizedBlockArguments,
      "{% block 'button', unknown: 'val' %}x{% endblock %}",
      'templates/test.liquid',
      {},
      { 'blocks/button.liquid': NO_DOC_BLOCK },
    );

    expect(offenses).toHaveLength(0);
  });

  it('does not report when block file does not exist', async () => {
    const offenses = await runLiquidCheck(
      UnrecognizedBlockArguments,
      "{% block 'missing', foo: 'bar' %}x{% endblock %}",
      'templates/test.liquid',
    );

    expect(offenses).toHaveLength(0);
  });
});
