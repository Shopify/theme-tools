import { describe, expect, it } from 'vitest';
import { check } from '../../test/test-helper';
import { MockTheme } from '../../test/MockTheme';
import {
  horizonNestedBlockSchema,
  createHorizonBlockSchema,
  createDawnSectionSchema,
  validDawnDefaultSchema,
  validDawnPresetSchema,
  validHorizonPresetSchema,
  validHorizonDefaultSchema,
} from './valid-schema-utils';
import { ValidPresetAndDefaultSettings } from '.';

const invalidBlockPresetSchema = {
  name: 'Tabbed content',
  settings: {
    invalid_setting: 'this is an invalid setting as this key does not exist',
  },
  blocks: [
    {
      type: '_tab',
      settings: {
        title: 'Tab 1',
      },
      blocks: [
        {
          type: 'text',
        },
      ],
    },
    {
      type: '_tab',
      settings: {
        title: 'Tab 2',
        invalid_nested_setting: 'this is an invalid setting as this key does not exist',
      },
      blocks: [
        {
          type: 'text',
          settings: {
            invalid_nested_setting_1: 'this is an invalid setting as this key does not exist',
          },
        },
      ],
    },
    {
      type: '_tab',
      settings: {
        title: 'Tab 3',
      },
      blocks: [
        {
          type: 'text',
          blocks: [
            {
              type: 'text',
              settings: {
                invalid_nested_setting_2: 'this is an invalid setting as this key does not exist',
              },
            },
          ],
        },
      ],
    },
  ],
};

const invalidBlockDefaultSchema = {
  settings: {
    invalid_setting: 'this is an invalid setting as this key does not exist',
  },
  blocks: [
    { type: '_tab', settings: { title: 'Tab 1' }, blocks: [{ type: 'text' }] },
    { type: '_tab', settings: { title: 'Tab 2' }, blocks: [{ type: 'text' }] },
    {
      type: '_tab',
      settings: {
        title: 'Tab 3',
        invalid_nested_setting_1: 'this is an invalid setting as this key does not exist',
      },
      blocks: [
        {
          type: 'text',
          settings: {
            invalid_nested_setting_2: 'this is an invalid setting as this key does not exist',
          },
        },
      ],
    },
  ],
};

const invalidSectionPresetSchema = {
  name: 't:sections.announcement-bar.presets.name',
  settings: {
    invalid_setting: 'this is an invalid setting as this key does not exist',
  },
  blocks: [
    {
      type: 'announcement',
      settings: {
        invalid_nested_setting_1: 'this is an invalid setting as this key does not exist',
      },
      blocks: [
        {
          type: 'text',
          settings: {
            invalid_nested_setting_3: 'this is an invalid setting as this key does not exist',
          },
        },
      ],
    },
    {
      type: '_tab',
      settings: {
        title: 'Tab 1',
        invalid_nested_setting_2: 'this is an invalid setting as this key does not exist',
      },
      blocks: [
        {
          type: 'text',
        },
      ],
    },
  ],
};

const invalidSectionDefaultSchema = {
  settings: {
    invalid_setting: 'this is an invalid setting as this key does not exist',
  },
  blocks: [
    {
      type: 'announcement',
      settings: {
        title: 'Tab 1',
        invalid_nested_setting_1: 'this is an invalid setting as this key does not exist',
      },
      blocks: [
        {
          type: 'text',
          settings: {
            invalid_nested_setting_2: 'this is an invalid setting as this key does not exist',
          },
        },
        {
          type: 'text',
          settings: {
            invalid_nested_setting_3: 'this is an invalid setting as this key does not exist',
          },
          blocks: [
            {
              type: 'text',
              settings: {
                invalid_nested_setting_4: 'this is an invalid setting as this key does not exist',
              },
            },
          ],
        },
      ],
    },
  ],
};

describe('ValidPresetAndDefaultSettings', () => {
  describe('blocks', () => {
    it('should report invalid keys within preset settings', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'blocks/tabs.liquid': createHorizonBlockSchema(invalidBlockPresetSchema, null),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(4);
      expect(offenses[0].message).to.include(
        'Preset setting "invalid_setting" does not exist in settings',
      );
      expect(offenses[1].message).to.include(
        'Preset block setting "invalid_nested_setting" does not exist in settings',
      );
      expect(offenses[2].message).to.include(
        'Preset block setting "invalid_nested_setting_1" does not exist in settings',
      );
      expect(offenses[3].message).to.include(
        'Preset block setting "invalid_nested_setting_2" does not exist in settings',
      );
    });

    it('should report invalid keys within default settings', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'blocks/tabs.liquid': createHorizonBlockSchema(null, invalidBlockDefaultSchema),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(3);
      expect(offenses[0].message).to.include(
        'Default setting "invalid_setting" does not exist in settings',
      );
      expect(offenses[1].message).to.include(
        'Default block setting "invalid_nested_setting_1" does not exist in settings',
      );
      expect(offenses[2].message).to.include(
        'Default block setting "invalid_nested_setting_2" does not exist in settings',
      );
    });

    it('should not report when all preset settings in the block are valid', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'blocks/tabs.liquid': validHorizonPresetSchema,
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(0);
    });

    it('should not report when all default settings in the block are valid', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'blocks/tabs.liquid': validHorizonDefaultSchema,
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(0);
    });
  });

  describe('sections', () => {
    it('should report invalid keys within preset setting', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'blocks/announcement.liquid': horizonNestedBlockSchema,
        'sections/announcement-bar.liquid': createDawnSectionSchema(
          invalidSectionPresetSchema,
          null,
        ),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(4);
      expect(offenses[0].message).to.include(
        `Preset setting "invalid_setting" does not exist in settings`,
      );
      expect(offenses[1].message).to.include(
        `Preset block setting "invalid_nested_setting_1" does not exist in settings`,
      );
      expect(offenses[2].message).to.include(
        `Preset block setting "invalid_nested_setting_3" does not exist in settings`,
      );
      expect(offenses[3].message).to.include(
        `Preset block setting "invalid_nested_setting_2" does not exist in settings`,
      );
    });

    it('should report invalid keys in a sections default setting', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'sections/announcement-bar.liquid': createDawnSectionSchema(
          null,
          invalidSectionDefaultSchema,
        ),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(5);
      expect(offenses[0].message).to.include(
        `Default setting "invalid_setting" does not exist in settings`,
      );
      expect(offenses[1].message).to.include(
        `Default block setting "invalid_nested_setting_1" does not exist in settings`,
      );
      expect(offenses[2].message).to.include(
        `Default block setting "invalid_nested_setting_2" does not exist in settings`,
      );
      expect(offenses[3].message).to.include(
        `Default block setting "invalid_nested_setting_3" does not exist in settings`,
      );
      expect(offenses[4].message).to.include(
        `Default block setting "invalid_nested_setting_4" does not exist in settings`,
      );
    });

    it('should not report when all preset settings are valid', async () => {
      const theme: MockTheme = {
        'sections/announcement-bar.liquid': validDawnPresetSchema,
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(0);
    });

    it('should not report when all default settings are valid', async () => {
      const theme: MockTheme = {
        'sections/announcement-bar.liquid': validDawnDefaultSchema,
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(0);
    });
  });
});
