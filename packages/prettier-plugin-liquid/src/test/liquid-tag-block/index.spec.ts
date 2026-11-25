import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-block', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
