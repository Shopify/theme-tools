import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: html-dangling-tag-exception', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
