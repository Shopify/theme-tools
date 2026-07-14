import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: example', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
