import { describe, it, expect } from 'vitest';
import { runLiquidCheck } from '../../test';
import { UnrecognizedContentForArguments } from '.';
import { RESERVED_CONTENT_FOR_ARGUMENTS } from '../../tags/content-for';

function check(snippet: string, source: string) {
  return runLiquidCheck(
    UnrecognizedContentForArguments,
    source,
    undefined,
    {},
    {
      'blocks/card.liquid': snippet,
    },
  );
}

const defaultSnippet = `
  {% doc %}
    @param {string} required_string - A required string
    @param {number} required_number - A required number
    @param {boolean} required_boolean - A required boolean
    @param {object} required_object - A required object
    @param {string} [optional_string] - An optional string
    @param {number} [optional_number] - An optional number
    @param {object} [optional_object] - An optional object
    @param {boolean} [optional_boolean] - An optional boolean
  {% enddoc %}
`;

describe('Module: UnrecognizedContentForArguments', () => {
  describe('unknown arguments', () => {
    it('should report unknown arguments that are provided in the content_for markup', async () => {
      const sourceCode = `
        {% content_for 'block',
        type: 'card',
        required_string: 'My Card',
        required_number: 1,
        required_boolean: true,
        required_object: product,
        unknown_param: 'unknown',
        second_unknown_param: 'second unknown',
        %}
        `;
      const offenses = await check(defaultSnippet, sourceCode);

      expect(offenses).toHaveLength(2);
      expect(offenses[0].message).toBe(
        "Unknown argument 'unknown_param' in content_for tag for static block 'card'.",
      );
      expect(offenses[1].message).toBe(
        "Unknown argument 'second_unknown_param' in content_for tag for static block 'card'.",
      );
    });
  });

  describe('edge cases', () => {
    it('should not report when static block has no doc comment', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        UnrecognizedContentForArguments,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `<h1>This block has no doc comment</h1>`,
        },
      );

      expect(offenses).toHaveLength(0);
    });

    it('should not report when LiquidDoc definition has no defined params', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        UnrecognizedContentForArguments,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
              {% doc %}
                @description this is a description
                @example this is an example
              {% enddoc %}
              <div>{{ title }}</div>
              <div>{{ description }}</div>
            `,
        },
      );

      expect(offenses).toHaveLength(0);
    });

    it('should not report when block name is a VariableLookup', async () => {
      const sourceCode = `{% assign block_name = 'card' %}{% content_for 'block', type: block_name, title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        UnrecognizedContentForArguments,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
              {% doc %}
                @param {string} title - The title of the card
                @param {string} description - The description of the card
              {% enddoc %}
              <div>{{ title }}</div>
              <div>{{ description }}</div>
            `,
        },
      );

      expect(offenses).toHaveLength(0);
    });

    it('should not report when argument begins with `.closest`', async () => {
      const offenses = await check(
        `
        {% doc %}
          @param {string} title - The title of the card
        {% enddoc %}
        <div>{{ title }}</div>
        `,
        `{% content_for 'block', type: 'card', id: '123', closest.product: product %}`,
      );

      expect(offenses).toHaveLength(0);
    });

    it('should not report when argument is a reserved word', async () => {
      const offenses = await check(
        `
        {% doc %}
          @param {string} title - The title of the card
        {% enddoc %}
        <div>{{ title }}</div>
        `,
        `{% content_for 'block', type: 'card', id: '123', ${RESERVED_CONTENT_FOR_ARGUMENTS[0]}: product %}`,
      );

      expect(offenses).toHaveLength(0);
    });
  });
});
