import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: liquid-drop-variable-lookup', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
