import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-increment', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
