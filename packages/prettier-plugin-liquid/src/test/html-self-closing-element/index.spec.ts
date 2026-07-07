import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-self-closing-element', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
