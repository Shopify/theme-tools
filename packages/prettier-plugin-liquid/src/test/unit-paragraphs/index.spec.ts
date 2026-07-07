import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: unit-paragraphs', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
