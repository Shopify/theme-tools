import { describe, it, expect } from 'vitest';
import { applySuggestions, runLiquidCheck } from '../../test';
import { MissingContentForArguments } from '.';

function check(existingCode: string, source: string) {
  return runLiquidCheck(
    MissingContentForArguments,
    source,
    undefined,
    {},
    {
      'blocks/card.liquid': existingCode,
    },
  );
}

const blockSourceCode = `
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

describe('Module: MissingContentForArguments', () => {
  describe('missing required arguments', () => {
    it('should report missing required arguments', async () => {
      const offenses = await check(blockSourceCode, `{% content_for 'block', type: 'card' %}`);

      expect(offenses).toHaveLength(4);
      expect(offenses[0].message).toBe(
        "Missing required argument 'required_string' in content_for tag for static block 'card'.",
      );
      expect(offenses[1].message).toBe(
        "Missing required argument 'required_number' in content_for tag for static block 'card'.",
      );
      expect(offenses[2].message).toBe(
        "Missing required argument 'required_boolean' in content_for tag for static block 'card'.",
      );
      expect(offenses[3].message).toBe(
        "Missing required argument 'required_object' in content_for tag for static block 'card'.",
      );
    });
  });

  describe('suggestions', () => {
    it('should suggest adding missing required arguments when none already exist', async () => {
      const sourceCode = `{% content_for 'block', type: 'card' %}`;
      const offenses = await check(blockSourceCode, sourceCode);

      expect(offenses).toHaveLength(4);
      const x = applySuggestions(sourceCode, offenses[0]);
      expect(x).toEqual([`{% content_for 'block', type: 'card', required_string: '' %}`]);
    });
  });

  describe('edge cases', () => {
    it('should handle mixed case type annotations', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', text: "hello", count: 5, flag: true, data: product %}`;
      const offenses = await runLiquidCheck(
        MissingContentForArguments,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `
            {% doc %}
              @param {String} text - The text
              @param {NUMBER} count - The count
              @param {BOOLEAN} flag - The flag
              @param {Object} data - The data
            {% enddoc %}
            <div>{{ text }}{{ count }}{{ flag }}{{ data }}</div>
          `,
        },
      );
      expect(offenses).toHaveLength(0);
    });

    it('should not report when block has no doc comment', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        MissingContentForArguments,
        sourceCode,
        undefined,
        {},
        {
          'blocks/card.liquid': `<h1>This snippet has no doc comment</h1>`,
        },
      );

      expect(offenses).toHaveLength(0);
    });

    it('should not report when LiquidDoc definition has no defined params', async () => {
      const sourceCode = `{% content_for 'block', type: 'card', title: 'My Card' %}`;
      const offenses = await runLiquidCheck(
        MissingContentForArguments,
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
        MissingContentForArguments,
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
  });
});
