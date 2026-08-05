import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-liquid-drop-name', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
