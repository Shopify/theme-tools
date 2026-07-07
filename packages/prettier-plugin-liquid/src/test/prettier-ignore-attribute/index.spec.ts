import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: prettier-ignore-attribute', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
