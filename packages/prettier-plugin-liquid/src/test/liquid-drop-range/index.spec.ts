import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-drop-range', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
