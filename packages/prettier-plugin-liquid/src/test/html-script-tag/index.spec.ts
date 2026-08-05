import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-script-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
