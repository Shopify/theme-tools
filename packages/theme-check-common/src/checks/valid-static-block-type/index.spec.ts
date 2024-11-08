import { describe, expect, it } from 'vitest';
import { check, MockTheme } from '../../test';
import { ValidStaticBlockType } from '.';

describe('Module: ValidStaticBlockType', () => {
  const genericThemeBlock = {
    'blocks/valid.liquid': 'Hello world!',
  };

  const validTypeBlock = {
    'blocks/file.liquid': '{% content_for "block", type: "valid", id: "static-block" %}',
  };

  const invalidTypeBlock = {
    'blocks/file.liquid': '{% content_for "block", type: "invalid", id: "static-block" %}',
  };

  const validExtensionFiles: MockTheme = {
    ...genericThemeBlock,
    ...validTypeBlock,
  };

  const invalidExtensionFiles: MockTheme = {
    ...genericThemeBlock,
    ...invalidTypeBlock,
  };

  it('should not report any offenses if type is valid', async () => {
    const offenses = await check(validExtensionFiles);
    expect(offenses).toHaveLength(0);
  });

  it('should report an offense if type is invalid', async () => {
    const offenses = await check(invalidExtensionFiles);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).to.equal("'blocks/invalid.liquid' does not exist");
  });
});
