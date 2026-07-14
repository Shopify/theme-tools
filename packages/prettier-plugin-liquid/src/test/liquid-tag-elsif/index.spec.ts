import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-elsif', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
