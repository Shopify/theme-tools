import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-tag-paginate', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
