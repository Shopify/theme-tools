import { findRoot, makeFileExists } from '@shopify/theme-check-common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NodeFileSystem } from './NodeFileSystem';
import { makeTempWorkspace, Workspace } from './test/test-helpers';

const theme = {
  locales: {
    'en.default.json': JSON.stringify({ beverage: 'coffee' }),
    'fr.json': '{}',
  },
  snippets: {
    'header.liquid': '',
  },
};

describe('Unit: findRoot', () => {
  const fileExists = makeFileExists(NodeFileSystem);
  let workspace: Workspace;

  beforeAll(async () => {
    // We're intentionally not mocking here because we want to make sure
    // this works on Windows as well.
    workspace = await makeTempWorkspace({
      zipTheme: {
        ...theme,
      },
      gitRootTheme: {
        '.git': { HEAD: '' },
        ...theme,
      },
      configRootTheme: {
        '.theme-check.yml': '',
        ...theme,
      },
      multiRootTheme: {
        '.theme-check.yml': 'root: ./dist',
        dist: {
          ...theme,
        },
        src: {
          '.theme-check.yml': '',
          ...theme,
        },
      },
      appWithThemeAppExtension: {
        extensions: {
          myThemeAppExtension: {
            ...theme,
            'shopify.extension.toml': '',
          },
        },
      },
      appWithThemeAppExtensionNoConfig: {
        extensions: {
          myThemeAppExtension: {
            ...theme,
          },
        },
      },
      taeRootThemeCheckYML: {
        '.theme-check.yml': '',
        extensions: {
          myThemeAppExtension: {
            ...theme,
          },
        },
      },
    });
  });

  afterAll(async () => {
    await workspace.clean();
  });

  it('finds the root of a zipped theme', async () => {
    const root = await findRoot(workspace.uri('zipTheme'), fileExists);
    expect(root).toBe(workspace.uri('zipTheme'));
  });

  it('finds the root of a theme with a .git folder', async () => {
    const root = await findRoot(workspace.uri('gitRootTheme'), fileExists);
    expect(root).toBe(workspace.uri('gitRootTheme'));
  });

  it('finds the root of a theme with a .theme-check.yml file', async () => {
    const root = await findRoot(workspace.uri('configRootTheme'), fileExists);
    expect(root).toBe(workspace.uri('configRootTheme'));
  });

  it('finds the root of a theme with a .theme-check.yml file in a subdirectory with', async () => {
    const root = await findRoot(
      workspace.uri('multiRootTheme/dist/snippets/header.liquid'),
      fileExists,
    );
    expect(root).toBe(workspace.uri('multiRootTheme'));
  });

  it('finds the root of a theme with a .theme-check.yml file in a subdirectory', async () => {
    const root = await findRoot(
      workspace.uri('multiRootTheme/src/snippets/header.liquid'),
      fileExists,
    );
    expect(root).toBe(workspace.uri('multiRootTheme/src'));
  });

  it('finds the root of a theme app extension with a shopify.extension.toml file', async () => {
    const root = await findRoot(
      workspace.uri('appWithThemeAppExtension/extensions/myThemeAppExtension'),
      fileExists,
    );
    expect(root).toBe(workspace.uri('appWithThemeAppExtension/extensions/myThemeAppExtension'));
  });

  it('finds the root of a theme app extension without a shopify.extension.toml file', async () => {
    const root = await findRoot(
      workspace.uri('appWithThemeAppExtensionNoConfig/extensions/myThemeAppExtension'),
      fileExists,
    );
    expect(root).toBe(
      workspace.uri('appWithThemeAppExtensionNoConfig/extensions/myThemeAppExtension'),
    );
  });

  it('finds the root of a theme app extension with a .theme-check.yml file', async () => {
    const root = await findRoot(
      workspace.uri('taeRootThemeCheckYML/extensions/myThemeAppExtension'),
      fileExists,
    );
    expect(root).toBe(workspace.uri('taeRootThemeCheckYML'));
  });
});
