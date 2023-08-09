import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: liquid-tag-section', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
