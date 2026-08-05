import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';

test('Unit: document-paragraphs', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
