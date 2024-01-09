import { test } from 'vitest';
import { assertFormattedEqualsFixed } from '../test-helpers';
import * as path from 'path';

test('Unit: document-paragraphs', async () => {
  await assertFormattedEqualsFixed(__dirname);
});
