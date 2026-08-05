import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-prettier-ignore', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
