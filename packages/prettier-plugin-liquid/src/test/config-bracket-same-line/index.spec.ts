import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: config-bracket-same-line', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
