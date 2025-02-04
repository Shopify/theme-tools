import { describe, it, expect } from 'vitest';
import { schemaSettingsPropertyCompletionItems } from './schemaSettings';

describe('Unit: schemaSettings', () => {
  const translations = {
    title: 'Example Title',
  };

  describe('schemaSettingsPropertyCompletionItems', () => {
    it('returns completion item if setting has a valid id', () => {
      const completions = schemaSettingsPropertyCompletionItems(
        {
          settings: [
            {
              id: 'setting-id',
              label: 'Setting Label',
            },
          ],
        },
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
        {
          settings: [
            {
              id: 'setting-id',
              label: 't:title',
            },
          ],
        },
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
        {
          settings: [
            {
              label: 'Setting Label',
            },
          ],
        },
        translations,
      );
      expect(completions).to.have.lengthOf(0);
    });
  });
});
