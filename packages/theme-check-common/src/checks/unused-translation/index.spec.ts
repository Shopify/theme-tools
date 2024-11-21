import { expect, describe, it } from 'vitest';
import { autofix, check, highlightedOffenses } from '../../test';
import { UnusedTranslation } from '.';

describe('Module: UnusedTranslation', async () => {
  it('should report a warning when there is an unused translation', async () => {
    const offenses = await check(
        {
          source: '',
          'locales/en.default.json': `{
            "unused_key": "This translation is never used",
            "used_key": "This one is used"
          }`,
          'sections/header.liquid': `
            {{ 'used_key' | t }}
          `
        },
        [UnusedTranslation],
      );
    
    expect(offenses).toHaveLength(1);
    expect(offenses[0]).toMatchObject({
      check: 'UnusedTranslation',
      message: "The translation key 'unused_key' is defined but never used",
      uri: "file:///sections/header.liquid"
    });
  });


  it('should not report when there is no unused translation', async () => {
    const offenses = await check(
        {
          source: '',
          'locales/en.default.json': `{
            "used_key": "This one is used"
          }`,
          'sections/header.liquid': `
            {{ 'used_key' | t }}
          `
        },
        [UnusedTranslation],
      );
    
     
    expect(offenses).toHaveLength(0);
  });
});
