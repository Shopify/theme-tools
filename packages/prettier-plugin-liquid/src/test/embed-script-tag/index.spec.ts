import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: embed-script-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
