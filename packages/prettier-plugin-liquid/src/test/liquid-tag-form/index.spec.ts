import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-form', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
