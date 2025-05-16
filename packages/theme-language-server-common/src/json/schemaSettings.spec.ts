import { describe, it, expect } from 'vitest';
import { getSectionBlockByName, schemaSettingsPropertyCompletionItems } from './schemaSettings';

describe('Unit: schemaSettings', () => {
  const translations = {
    title: 'Example Title',
  };

  describe('schemaSettingsPropertyCompletionItems', () => {
    it('returns completion item if setting has a valid id', () => {
      const completions = schemaSettingsPropertyCompletionItems(
        [
          {
            id: 'setting-id',
            label: 'Setting Label',
          },
        ],
        translations,
      );

      expect(completions).to.have.lengthOf(1);
      expect(completions).toContainEqual(
        expect.objectContaining({
          insertText: '"setting-id"',
          documentation: expect.objectContaining({
            value: 'Setting Label',
          }),
        }),
      );
    });

    it('returns translated completion item', () => {
      const completions = schemaSettingsPropertyCompletionItems(
        [
          {
            id: 'setting-id',
            label: 't:title',
          },
        ],

        translations,
      );

      expect(completions).to.have.lengthOf(1);
      expect(completions).toContainEqual(
        expect.objectContaining({
          insertText: '"setting-id"',
          documentation: expect.objectContaining({
            value: 'Example Title',
          }),
        }),
      );
    });

    it("does not return completion item if setting doesn't have id", () => {
      const completions = schemaSettingsPropertyCompletionItems(
        [
          {
            label: 'Setting Label',
          },
        ],
        translations,
      );
      expect(completions).to.have.lengthOf(0);
    });
  });

  describe('getSectionBlockByName', () => {
    it('does not return block if parsedSchema is empty', () => {
      expect(getSectionBlockByName(undefined, 'block-name')).toBeUndefined();
    });

    it('does not return block if it is not a section block is empty', () => {
      expect(
        getSectionBlockByName(
          {
            blocks: [
              {
                type: 'block-name',
              },
            ],
          },
          'block-name',
        ),
      ).toBeUndefined();
    });

    it('does return block if it is a section block is empty', () => {
      const block = {
        type: 'block-name',
        name: 'block name',
      };
      expect(
        getSectionBlockByName(
          {
            blocks: [block],
          },
          'block-name',
        ),
      ).toBe(block);
    });
  });
});
