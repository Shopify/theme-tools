import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-comment', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
