import { describe, expect, it } from 'vitest';
import { UnrecognizedBlockArguments } from './index';
import {
  blockSource,
  INVALID_SCHEMA_BLOCK,
  liquidDocBlock,
  runBlockCallCheck,
} from '../../test/block-fixtures';

const MERGED_BLOCK = blockSource(
  [{ id: 'heading', type: 'text' }],
  ['@param {string} tracking_id - Developer-only tracking id'],
);
const SCHEMA_ONLY_BLOCK = blockSource([{ id: 'heading', type: 'text' }]);
const LIQUID_DOC_ONLY_BLOCK = liquidDocBlock([
  '@param {string} tracking_id - Developer-only tracking id',
]);

describe('UnrecognizedBlockArguments', () => {
  it('accepts schema, LiquidDoc-only, and built-in content parameters', async () => {
    const offenses = await run(
      "{% block 'card', heading: 'Hello', tracking_id: 'hero', content: body %}{% endblock %}",
      MERGED_BLOCK,
    );

    expect(offenses).toEqual([]);
  });

  it('accepts a schema parameter without LiquidDoc', async () => {
    const offenses = await run(
      "{% block 'card', heading: 'Hello' %}{% endblock %}",
      SCHEMA_ONLY_BLOCK,
    );

    expect(offenses).toEqual([]);
  });

  it('reports an argument outside the merged interface', async () => {
    const offenses = await run(
      "{% block 'card', heading: 'Hello', unknown: true %}{% endblock %}",
      MERGED_BLOCK,
    );

    expect(offenses).toMatchObject([
      { message: "Unknown argument 'unknown' in block tag for 'card'." },
    ]);
  });

  it('validates the LiquidDoc-only interface of a schema-less block', async () => {
    const offenses = await run(
      "{% block 'card', tracking_id: 'hero', unknown: true %}{% endblock %}",
      LIQUID_DOC_ONLY_BLOCK,
    );

    expect(offenses).toMatchObject([
      { message: "Unknown argument 'unknown' in block tag for 'card'." },
    ]);
  });

  it('preserves block.name as the supported caller-side system argument', async () => {
    const offenses = await run(
      "{% block 'card', block.name: 'Card' %}{% endblock %}",
      MERGED_BLOCK,
    );

    expect(offenses).toEqual([]);
  });

  it.each([
    "{% block 'card', block.settings.heading: 'Hello', unknown: true %}{% endblock %}",
    "{% block 'card', block.unknown: 'value', unknown: true %}{% endblock %}",
  ])('leaves dotted arguments to LiquidSyntaxError in %s', async (template) => {
    const offenses = await run(template, MERGED_BLOCK);

    expect(offenses).toEqual([]);
  });

  it.each([
    ['missing target', undefined],
    ['invalid target schema', INVALID_SCHEMA_BLOCK],
  ])('does not report unknown arguments for an unreadable %s', async (_name, block) => {
    const offenses = await run("{% block 'card', unknown: 'value' %}{% endblock %}", block);

    expect(offenses).toEqual([]);
  });
});

function run(template: string, block: string | undefined) {
  return runBlockCallCheck(UnrecognizedBlockArguments, template, block);
}
