import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: prettier-ignore-start / prettier-ignore-end range', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
