import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: embed-liquid-stylesheet-tag', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
