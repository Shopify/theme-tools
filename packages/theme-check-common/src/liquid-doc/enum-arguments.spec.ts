import { describe, expect, it } from 'vitest';
import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';
import { ValidRenderSnippetArgumentTypes } from '../checks/valid-render-snippet-argument-types';
import { ValidContentForArgumentTypes } from '../checks/valid-content-for-argument-types';
import { ValidBlockArgumentTypes } from '../checks/valid-block-argument-types';
import { MissingRenderSnippetArguments } from '../checks/missing-render-snippet-arguments';
import { MissingContentForArguments } from '../checks/missing-content-for-arguments';
import { MissingBlockArguments } from '../checks/missing-block-arguments';
import { applySuggestions, runLiquidCheck } from '../test';

const enumType = `'heading' | "small"`;

function definition(type = enumType, optional = true) {
  return `{% doc %}
    @param {${type}} ${optional ? '[variant]' : 'variant'} - Text style
  {% enddoc %}
  {{ variant }}`;
}

const namedCallers = [
  {
    name: 'render',
    check: ValidRenderSnippetArgumentTypes,
    missingCheck: MissingRenderSnippetArguments,
    file: 'snippets/text.liquid',
    source: (value?: string) => `{% render 'text'${value ? `, variant: ${value}` : ''} %}`,
  },
  {
    name: 'content_for',
    check: ValidContentForArgumentTypes,
    missingCheck: MissingContentForArguments,
    file: 'blocks/text.liquid',
    source: (value?: string) =>
      `{% content_for 'block', type: 'text', id: 'text'${value ? `, variant: ${value}` : ''} %}`,
  },
  {
    name: 'block',
    check: ValidBlockArgumentTypes,
    missingCheck: MissingBlockArguments,
    file: 'blocks/text.liquid',
    source: (value?: string) =>
      `{% block 'text'${value ? `, variant: ${value}` : ''} %}Text{% endblock %}`,
  },
];

const aliasCallers = ['with', 'for'].map((keyword) => ({
  name: `render ${keyword} alias`,
  check: ValidRenderSnippetArgumentTypes,
  file: 'snippets/text.liquid',
  source: (value: string) => `{% render 'text' ${keyword} ${value} as variant %}`,
}));

describe('LiquidDoc enum arguments', () => {
  for (const caller of [...namedCallers, ...aliasCallers]) {
    describe(caller.name, () => {
      it.each(["'heading'", '"heading"', "'small'", '"small"'])(
        'accepts enum member %s',
        async (value) => {
          const offenses = await runLiquidCheck(
            caller.check,
            caller.source(value),
            'templates/index.liquid',
            {},
            { [caller.file]: definition() },
          );
          expect(offenses).toHaveLength(0);
        },
      );

      it.each(["'Heading'", "'body'", '123', 'false', 'nil', 'null', 'empty', 'blank', '(1..3)'])(
        'rejects literal %s and highlights only the value',
        async (value) => {
          const source = caller.source(value);
          const offenses = await runLiquidCheck(
            caller.check,
            source,
            'templates/index.liquid',
            {},
            { [caller.file]: definition() },
          );
          expect(offenses).toHaveLength(1);
          expect(offenses[0].message).toContain(enumType);
          expect(offenses[0].message).toContain(`got ${value}`);
          expect(source.slice(offenses[0].start.index, offenses[0].end.index)).toBe(value);
        },
      );

      it.each(['style', 'block.settings.style', "settings['style']"])(
        'leaves dynamic value %s unverified',
        async (value) => {
          const offenses = await runLiquidCheck(
            caller.check,
            caller.source(value),
            'templates/index.liquid',
            {},
            { [caller.file]: definition() },
          );
          expect(offenses).toHaveLength(0);
        },
      );

      it.each(["'heading' |", "'heading' | number", 'unknown'])(
        'does not cascade errors from unsupported declaration %s',
        async (type) => {
          const offenses = await runLiquidCheck(
            caller.check,
            caller.source("'body'"),
            'templates/index.liquid',
            {},
            { [caller.file]: definition(type) },
          );
          expect(offenses).toHaveLength(0);
        },
      );

      it('offers each allowed member as a replacement and preserves its quoting', async () => {
        const source = caller.source("'body'");
        const offenses = await runLiquidCheck(
          caller.check,
          source,
          'templates/index.liquid',
          {},
          { [caller.file]: definition() },
        );

        expect(offenses).toHaveLength(1);
        expect(offenses[0].suggest?.map((suggestion) => suggestion.message)).toEqual([
          "Replace with 'heading'",
          'Replace with "small"',
        ]);
        const suggestions = applySuggestions(source, offenses[0]);
        expect(suggestions).toEqual([caller.source("'heading'"), caller.source('"small"')]);
        for (const suggestion of suggestions ?? []) {
          expect(() => toLiquidHtmlAST(suggestion)).not.toThrow();
          expect(
            await runLiquidCheck(
              caller.check,
              suggestion,
              'templates/index.liquid',
              {},
              {
                [caller.file]: definition(),
              },
            ),
          ).toHaveLength(0);
        }
      });
    });
  }

  for (const caller of namedCallers) {
    it.each(['product', 'product[]', 'string[]'])(
      `${caller.name} preserves existing skips for named declaration %s`,
      async (type) => {
        const offenses = await runLiquidCheck(
          caller.check,
          caller.source("'heading'"),
          'templates/index.liquid',
          {},
          { [caller.file]: definition(type) },
        );
        expect(offenses).toHaveLength(0);
      },
    );

    it(`${caller.name} permits omission of an optional enum`, async () => {
      const offenses = await runLiquidCheck(
        caller.missingCheck,
        caller.source(),
        'templates/index.liquid',
        {},
        { [caller.file]: definition() },
      );
      expect(offenses).toHaveLength(0);
    });

    it(`${caller.name} reports omission of a required enum`, async () => {
      const offenses = await runLiquidCheck(
        caller.missingCheck,
        caller.source(),
        'templates/index.liquid',
        {},
        { [caller.file]: definition(enumType, false) },
      );
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toContain("Missing required argument 'variant'");
    });
  }

  for (const caller of aliasCallers) {
    it.each(['product', 'product[]', 'string[]'])(
      `${caller.name} preserves checking of literal values against named declaration %s`,
      async (type) => {
        const offenses = await runLiquidCheck(
          caller.check,
          caller.source('123'),
          'templates/index.liquid',
          {},
          { [caller.file]: definition(type) },
        );
        expect(offenses).toHaveLength(1);
        expect(offenses[0].message).toBe(
          `Type mismatch for argument 'variant': expected ${type}, got number`,
        );
      },
    );

    it('leaves dynamic alias values unverified for named declarations', async () => {
      const offenses = await runLiquidCheck(
        caller.check,
        caller.source('product'),
        'templates/index.liquid',
        {},
        { [caller.file]: definition('product') },
      );
      expect(offenses).toHaveLength(0);
    });
  }

  for (const caller of namedCallers.filter((caller) => caller.name !== 'block')) {
    it.each([`"Heading" | 'small'`, `'' | 'heading'`, `"a'b" | 'small'`])(
      `${caller.name} inserts a legal enum member for a missing required argument (%s)`,
      async (type) => {
        const source = caller.source();
        const firstMember = type.split(' | ')[0];
        const offenses = await runLiquidCheck(
          caller.missingCheck,
          source,
          'templates/index.liquid',
          {},
          { [caller.file]: definition(type, false) },
        );

        expect(offenses).toHaveLength(1);
        const suggestions = applySuggestions(source, offenses[0]);
        expect(suggestions).toEqual([caller.source(firstMember)]);
        for (const suggestion of suggestions ?? []) {
          expect(() => toLiquidHtmlAST(suggestion)).not.toThrow();
          expect(
            await runLiquidCheck(
              caller.check,
              suggestion,
              'templates/index.liquid',
              {},
              {
                [caller.file]: definition(type, false),
              },
            ),
          ).toHaveLength(0);
        }
      },
    );
  }

  it('ignores block system arguments even when their names appear in a doc definition', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      `{% block 'text', block.settings.style: 'body' %}Text{% endblock %}`,
      'templates/index.liquid',
      {},
      {
        'blocks/text.liquid': `{% doc %}
          @param {${enumType}} [block.settings.style] - Text style
        {% enddoc %}`,
      },
    );
    expect(offenses).toHaveLength(0);
  });

  it('rejects a block array literal for a string enum without trying to infer its primitive type', async () => {
    const source = `{% block 'text', variant: ['heading', 'small'] %}Text{% endblock %}`;
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      source,
      'templates/index.liquid',
      {},
      { 'blocks/text.liquid': definition() },
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toContain("got ['heading', 'small']");
    expect(source.slice(offenses[0].start.index, offenses[0].end.index)).toBe(
      "['heading', 'small']",
    );
  });

  it('leaves block array literals unverified for primitive declarations', async () => {
    const offenses = await runLiquidCheck(
      ValidBlockArgumentTypes,
      `{% block 'text', variant: ['heading'] %}Text{% endblock %}`,
      'templates/index.liquid',
      {},
      { 'blocks/text.liquid': definition('string') },
    );
    expect(offenses).toHaveLength(0);
  });
});
