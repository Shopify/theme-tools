import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: yaml-frontmatter', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
