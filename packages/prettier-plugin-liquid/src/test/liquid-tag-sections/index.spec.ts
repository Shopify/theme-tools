import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-sections', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
