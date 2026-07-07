import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: layout-html', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
