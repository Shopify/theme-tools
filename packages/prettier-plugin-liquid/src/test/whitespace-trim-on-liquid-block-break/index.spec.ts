import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: whitespace-trim-on-liquid-block-break', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
