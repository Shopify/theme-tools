import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: html-custom-element', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
