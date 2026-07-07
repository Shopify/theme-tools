import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-drop-variable-lookup', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
