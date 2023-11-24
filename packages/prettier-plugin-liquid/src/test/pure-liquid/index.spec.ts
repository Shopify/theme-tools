import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: pure-liquid', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
