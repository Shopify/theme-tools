import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: config-bracket-same-line', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
