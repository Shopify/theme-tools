import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: yaml-frontmatter', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
