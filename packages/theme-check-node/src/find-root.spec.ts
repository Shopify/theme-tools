import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { findRoot } from './find-root';
import { Workspace } from './test/test-helpers';
import { makeTempWorkspace } from './test/test-helpers';

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
    const root = await findRoot(workspace.path('zipTheme'));
    expect(root).toBe(workspace.path('zipTheme'));
  });

  it('finds the root of a theme with a .git folder', async () => {
    const root = await findRoot(workspace.path('gitRootTheme'));
    expect(root).toBe(workspace.path('gitRootTheme'));
  });

  it('finds the root of a theme with a .theme-check.yml file', async () => {
    const root = await findRoot(workspace.path('configRootTheme'));
    expect(root).toBe(workspace.path('configRootTheme'));
  });

  it('finds the root of a theme with a .theme-check.yml file in a subdirectory with', async () => {
    const root = await findRoot(workspace.path('multiRootTheme/dist/snippets/header.liquid'));
    expect(root).toBe(workspace.path('multiRootTheme'));
  });

  it('finds the root of a theme with a .theme-check.yml file in a subdirectory', async () => {
    const root = await findRoot(workspace.path('multiRootTheme/src/snippets/header.liquid'));
    expect(root).toBe(workspace.path('multiRootTheme/src'));
  });

  it('finds the root of a theme app extension with a shopify.extension.toml file', async () => {
    const root = await findRoot(
      workspace.path('appWithThemeAppExtension/extensions/myThemeAppExtension'),
    );
    expect(root).toBe(workspace.path('appWithThemeAppExtension/extensions/myThemeAppExtension'));
  });

  it('finds the root of a theme app extension without a shopify.extension.toml file', async () => {
    const root = await findRoot(
      workspace.path('appWithThemeAppExtensionNoConfig/extensions/myThemeAppExtension'),
    );
    expect(root).toBe(
      workspace.path('appWithThemeAppExtensionNoConfig/extensions/myThemeAppExtension'),
    );
  });

  it('finds the root of a theme app extension with a .theme-check.yml file', async () => {
    const root = await findRoot(
      workspace.path('taeRootThemeCheckYML/extensions/myThemeAppExtension'),
    );
    expect(root).toBe(workspace.path('taeRootThemeCheckYML'));
  });
});
