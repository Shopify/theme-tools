import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: embed-liquid-javascript-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
