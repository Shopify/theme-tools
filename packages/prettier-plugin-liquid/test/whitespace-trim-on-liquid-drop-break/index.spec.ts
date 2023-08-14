import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: whitespace-trim-on-liquid-drop-break', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
