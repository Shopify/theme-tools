import { describe, expect, it } from 'vitest';
import { check, MockTheme } from '../../test';
import { CyclicalDependencies } from '.';

describe('Module: CyclicalDependencies', () => {
  const blockA = {
    'blocks/block_b.liquid': '{% content_for "block", type: "block_b", id: "static-block-b" %}',
  };

  const blockB = {
    'blocks/block_b.liquid': '{% content_for "block", type: "block_a", id: "static-block-a" %}',
  };

  const blockC = {
    'blocks/block_c.liquid': 'Hello world!',
  };

  const parentBlockValid = {
    'blocks/file.liquid': '{% content_for "block", type: "block_c", id: "static-block" %}',
  };

  const parentBlockInvalid = {
    'blocks/file.liquid': '{% content_for "block", type: "block_a", id: "static-block" %}',
  };

  const invalidExtensionFiles: MockTheme = {
    ...blockA,
    ...blockB,
    ...parentBlockInvalid,
  };

  const validExtensionFiles: MockTheme = {
    ...blockC,
    ...parentBlockValid,
  };

  it('should not report any offenses if type is valid', async () => {
    const offenses = await check(validExtensionFiles);
    expect(offenses).toHaveLength(0);
  });

  // it('should report an offense if type is invalid', async () => {
  //   const offenses = await check(invalidExtensionFiles);
  //   expect(offenses).toHaveLength(1);
  //   expect(offenses[0].message).to.equal("'blocks/invalid.liquid' does not exist");
  // });
});
