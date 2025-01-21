import { describe, expect, it } from 'vitest';
import { check } from '../../test/test-helper';
import { MockTheme } from '../../test/MockTheme';
import {
  horizonNestedBlockSchema,
  createHorizonBlockSchema,
  createDawnSectionSchema,
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
          settings: {
            invalid_nested_setting_2: 'this is an invalid setting as this key does not exist',
          },
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
            invalid_nested_setting_2: 'this is an invalid setting as this key does not exist',
          },
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
      expect(offenses).to.have.length(3);
      expect(offenses[0].message).to.include(
        'Preset setting "invalid_setting" does not exist in settings',
      );
      expect(offenses[1].message).to.include(
        'Preset block setting "invalid_nested_setting" does not exist in settings',
      );
      expect(offenses[2].message).to.include(
        'Preset block setting "invalid_nested_setting_2" does not exist in settings',
      );
    });

    it('should report invalid keys within default settings', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'blocks/tabs.liquid': createHorizonBlockSchema(null, invalidBlockDefaultSchema),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      console.log(offenses);
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

    it('should not report when all preset and default settings in the block are valid', async () => {
      const theme: MockTheme = {
        'blocks/_tab.liquid': horizonNestedBlockSchema,
        'blocks/tabs.liquid': createHorizonBlockSchema(),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(0);
    });
  });

  describe('sections', () => {
    it('should report invalid keys within preset setting', async () => {
      const theme: MockTheme = {
        'sections/announcement-bar.liquid': createDawnSectionSchema(
          invalidSectionPresetSchema,
          null,
        ),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(3);
      expect(offenses[0].message).to.include(
        `Preset setting "invalid_setting" does not exist in settings`,
      );
      expect(offenses[1].message).to.include(
        `Preset block setting "invalid_nested_setting_1" does not exist in settings`,
      );
      expect(offenses[2].message).to.include(
        `Preset block setting "invalid_nested_setting_2" does not exist in settings`,
      );
    });

    it('should report invalid keys in a sections default setting', async () => {
      const theme: MockTheme = {
        'sections/announcement-bar.liquid': createDawnSectionSchema(
          null,
          invalidSectionDefaultSchema,
        ),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(3);
      expect(offenses[0].message).to.include(
        `Default setting "invalid_setting" does not exist in settings`,
      );
      expect(offenses[1].message).to.include(
        `Default block setting "invalid_nested_setting_1" does not exist in settings`,
      );
      expect(offenses[2].message).to.include(
        `Default block setting "invalid_nested_setting_2" does not exist in settings`,
      );
    });

    it('should not report when all preset and default settings are valid', async () => {
      const theme: MockTheme = {
        'sections/announcement-bar.liquid': createDawnSectionSchema(),
      };

      const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
      expect(offenses).to.have.length(0);
    });
  });
});
