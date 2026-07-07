import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-layout', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
