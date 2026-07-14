import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-void-element-whitespace-borrowing', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
