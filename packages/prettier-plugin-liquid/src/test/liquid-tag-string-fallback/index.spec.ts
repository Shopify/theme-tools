import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-string-fallback', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
