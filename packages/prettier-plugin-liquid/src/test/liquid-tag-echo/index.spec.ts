import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-echo', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
