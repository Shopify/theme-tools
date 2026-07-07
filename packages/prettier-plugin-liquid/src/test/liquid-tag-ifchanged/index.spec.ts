import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-ifchanged', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
