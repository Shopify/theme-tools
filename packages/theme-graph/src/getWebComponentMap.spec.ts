import { path } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { describe, expect, it } from 'vitest';
import { getWebComponentMap } from './getWebComponentMap';
import { makeGetSourceCode } from './graph/test-helpers';

describe('Unit: getWebComponentMap', () => {
  it('returns an empty map for a theme without an assets folder', async () => {
    const rootUri = path.normalize('file:/');
    const fs = new MockFileSystem({ 'sections/main.liquid': '<price-tag></price-tag>' }, rootUri);
    const map = await getWebComponentMap(rootUri, { fs, getSourceCode: makeGetSourceCode(fs) });
    expect(map.size).toBe(0);
  });
});
