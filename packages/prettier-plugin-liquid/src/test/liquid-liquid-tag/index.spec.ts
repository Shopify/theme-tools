import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-liquid-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
