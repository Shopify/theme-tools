import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: whitespace-trim-on-liquid-drop-break', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
