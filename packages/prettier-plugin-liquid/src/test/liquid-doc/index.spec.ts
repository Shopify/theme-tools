import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-doc', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
