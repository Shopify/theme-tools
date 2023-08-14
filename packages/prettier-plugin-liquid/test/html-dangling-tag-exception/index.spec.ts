import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: html-dangling-tag-exception', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
