import { describe, expect, it } from 'vitest';
import { LiquidSyntaxError } from '../liquid-syntax-error';
import { recommended } from '../index';
import { check, highlightedOffenses, runLiquidCheck } from '../../test';
import { ValidBlockTagPlacement } from './index';

const BLOCK_TAG = "{% block 'card' %}Card{% endblock %}";
const INNER_BLOCK_TAG = "{% block 'inner' %}Inner{% endblock %}";
const BLOCK_TAG_UNDER_CONTROL_FLOW = `{% if product.available %}${BLOCK_TAG}{% endif %}`;
const NESTED_BLOCK_TAGS = `{% block 'outer' %}Before${INNER_BLOCK_TAG}After{% endblock %}`;
const BLOCK_TAG_NESTED_THROUGH_CONTROL_FLOW = `{% block 'outer' %}{% if product.available %}${INNER_BLOCK_TAG}{% endif %}{% endblock %}`;
const NESTED_BLOCK_TAGS_INSIDE_LIQUID = [
  '{% liquid',
  "  block 'outer'",
  "    block 'inner'",
  '    endblock',
  '  endblock',
  '%}',
].join('\n');

const BLOCK_TAG_CASES = [
  {
    description: 'a direct block tag',
    source: BLOCK_TAG,
    highlights: [BLOCK_TAG],
  },
  {
    description: 'a block tag under control flow',
    source: BLOCK_TAG_UNDER_CONTROL_FLOW,
    highlights: [BLOCK_TAG],
  },
  {
    description: 'nested block tags',
    source: NESTED_BLOCK_TAGS,
    highlights: [NESTED_BLOCK_TAGS, INNER_BLOCK_TAG],
  },
  {
    description: 'a block tag nested through control flow',
    source: BLOCK_TAG_NESTED_THROUGH_CONTROL_FLOW,
    highlights: [BLOCK_TAG_NESTED_THROUGH_CONTROL_FLOW, INNER_BLOCK_TAG],
  },
  {
    description: 'nested block tags inside a liquid tag',
    source: NESTED_BLOCK_TAGS_INSIDE_LIQUID,
    highlights: [
      "block 'outer'\n    block 'inner'\n    endblock\n  endblock",
      "block 'inner'\n    endblock",
    ],
  },
];

const ALLOWED_FILES = [
  'templates/index.liquid',
  'templates/metaobject/product.liquid',
  'templates/metaobject/custom/product.liquid',
  'layout/theme.liquid',
  'templates\\index.liquid',
  'templates\\metaobject\\product.liquid',
  'layout\\theme.liquid',
];

const DISALLOWED_FILES = [
  'blocks/card.liquid',
  'sections/main.liquid',
  'snippets/card.liquid',
  'assets/card.liquid',
  'theme.liquid',
  'layout/custom/theme.liquid',
  'snippets\\card.liquid',
];

const MESSAGE = "The 'block' tag can only be used in templates/**/*.liquid and layout/*.liquid.";

describe('ValidBlockTagPlacement', () => {
  it('is enabled in the recommended configuration', () => {
    expect(recommended).toContain(ValidBlockTagPlacement);
  });

  describe('allowed template and layout files', () => {
    it.each(blockTagMatrix(ALLOWED_FILES))(
      'allows $description in $fileName',
      async ({ fileName, source }) => {
        const offenses = await runLiquidCheck(ValidBlockTagPlacement, source, fileName);

        expect(offenses).toEqual([]);
      },
    );
  });

  describe('all other theme files', () => {
    it.each(blockTagMatrix(DISALLOWED_FILES))(
      'reports $description in $fileName',
      async ({ fileName, source, highlights }) => {
        const offenses = await runLiquidCheck(ValidBlockTagPlacement, source, fileName);

        expect(offenses).toHaveLength(highlights.length);
        expect(offenses).toMatchObject(highlights.map(() => ({ message: MESSAGE })));
        expect(highlightedOffenses({ [fileName.replace(/\\/g, '/')]: source }, offenses)).toEqual(
          highlights,
        );
      },
    );
  });

  it.each([
    ['unstructured markup', '{% block card %}{% endblock %}'],
    ['structured markup', "{% block 'card', block.bad: true %}Card{% endblock %}"],
  ])('leaves malformed block tags with %s to LiquidSyntaxError', async (_name, source) => {
    const theme = {
      'snippets/card.liquid': source,
    };
    const offenses = await check(theme, [LiquidSyntaxError, ValidBlockTagPlacement]);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].check).toBe('LiquidSyntaxError');
  });
});

function blockTagMatrix(fileNames: string[]) {
  return fileNames.flatMap((fileName) =>
    BLOCK_TAG_CASES.map((testCase) => ({ ...testCase, fileName })),
  );
}
