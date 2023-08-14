import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: liquid-drop-liquid-literal', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
