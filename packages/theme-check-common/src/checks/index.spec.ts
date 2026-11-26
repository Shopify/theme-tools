import { describe, expect, it } from 'vitest';
import { allChecks } from './index';

/** Checks without a shopify.dev page yet. Add the url when the page is published. */
const withoutDocsPage = ['UniqueSettingId'];

describe('allChecks', () => {
  it('links every check to its shopify.dev reference', () => {
    const unlinked = allChecks
      .filter((check) => !check.meta.docs.url)
      .map((check) => check.meta.code);

    expect(unlinked).toEqual(withoutDocsPage);
  });
});
