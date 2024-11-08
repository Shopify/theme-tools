import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-content-for', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
