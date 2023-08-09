import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: liquid-control-flow-branches', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
