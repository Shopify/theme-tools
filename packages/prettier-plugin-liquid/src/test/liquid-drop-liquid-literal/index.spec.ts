import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-drop-liquid-literal', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
