import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: liquid-prettier-ignore', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
