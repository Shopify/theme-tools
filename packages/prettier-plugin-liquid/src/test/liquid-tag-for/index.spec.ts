import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-for', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
