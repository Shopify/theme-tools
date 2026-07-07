import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-drop-filters', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
