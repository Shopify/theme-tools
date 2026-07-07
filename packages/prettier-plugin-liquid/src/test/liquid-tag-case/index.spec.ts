import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-case', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
