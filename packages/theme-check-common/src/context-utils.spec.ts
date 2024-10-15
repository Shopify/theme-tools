import { beforeEach, describe, expect, it } from 'vitest';
import { getDefaultLocaleFactory } from './context-utils';
import { MockFileSystem } from './test';
import { AbstractFileSystem } from './AbstractFileSystem';

describe('Unit: getDefaultLocale', () => {
  let fs: AbstractFileSystem;
  beforeEach(() => {
    fs = new MockFileSystem(
      {
        'gitRootTheme/locales/en.default.json': JSON.stringify({ beverage: 'coffee' }),
        'gitRootTheme/locales/fr.json': JSON.stringify({ beverage: 'coffee' }),
        'gitRootTheme/snippet/foo.liquid': JSON.stringify({ beverage: 'coffee' }),
        'frenchDefault/locales/fr.default.json': JSON.stringify({ beverage: 'café' }),
        'frenchDefault/snippet/foo.liquid': JSON.stringify({ beverage: 'coffee' }),
      },
      'shopify-vfs:/',
    );
  });

  it('should return the correct translations depending on the root', async () => {
    let getDefaultLocale = getDefaultLocaleFactory(fs, 'shopify-vfs:/gitRootTheme');
    expect(await getDefaultLocale()).to.eql('en');

    getDefaultLocale = getDefaultLocaleFactory(fs, 'shopify-vfs:/frenchDefault');
    expect(await getDefaultLocale()).to.eql('fr');
  });
});
