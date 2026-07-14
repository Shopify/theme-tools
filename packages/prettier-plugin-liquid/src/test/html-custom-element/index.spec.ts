import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-custom-element', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
