import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: multiline-liquid', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
