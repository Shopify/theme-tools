import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: pure-liquid', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
