import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-section', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
