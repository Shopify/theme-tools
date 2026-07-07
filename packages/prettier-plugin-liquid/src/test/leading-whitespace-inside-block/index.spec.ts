import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: leading-whitespace-inside-block', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
