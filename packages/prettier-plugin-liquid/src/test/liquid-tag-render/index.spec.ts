import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-render', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
