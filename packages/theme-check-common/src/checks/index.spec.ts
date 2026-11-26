import { describe, expect, it } from 'vitest';
import { allChecks } from './index';

describe('allChecks', () => {
  it('links every check to its shopify.dev reference', () => {
    const unlinked = allChecks
      .filter((check) => !check.meta.docs.url)
      .map((check) => check.meta.code);

    expect(unlinked).toEqual([]);
  });
});
