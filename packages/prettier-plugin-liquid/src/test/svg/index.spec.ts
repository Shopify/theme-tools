import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: svg', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
