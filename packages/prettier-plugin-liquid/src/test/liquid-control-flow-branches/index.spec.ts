import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: liquid-control-flow-branches', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
