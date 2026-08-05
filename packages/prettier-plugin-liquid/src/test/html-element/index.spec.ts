import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-element', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
