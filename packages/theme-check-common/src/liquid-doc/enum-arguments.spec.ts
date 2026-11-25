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
});
