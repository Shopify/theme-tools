import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-schema-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
