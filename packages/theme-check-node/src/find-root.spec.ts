import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { findRoot } from './find-root';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as mktemp from 'mktemp';

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

type Tree = {
  [k in string]: Tree | string;
};

interface Workspace {
  root: string;
  path(relativePath: string): string;
  clean(): Promise<any>;
}

async function makeTempWorkspace(structure: Tree): Promise<Workspace> {
  const root = await mktemp.createDir(path.join(__dirname, '..', '.XXXXX'));
  if (!root) throw new Error('Could not create temp dir for temp workspace');

  await createFiles(structure, [root]);

  return {
    root,
    path: (relativePath) => path.join(root, ...relativePath.split('/')),
    clean: async () => fs.rm(root, { recursive: true, force: true }),
  };

  function createFiles(tree: Tree, ancestors: string[]): Promise<any> {
    const promises: Promise<any>[] = [];
    for (const [pathEl, value] of Object.entries(tree)) {
      if (typeof value === 'string') {
        promises.push(fs.writeFile(path.join(...ancestors, pathEl), value, 'utf8'));
      } else {
        promises.push(
          fs
            .mkdir(path.join(...ancestors, pathEl))
            .then(() => createFiles(value, ancestors.concat(pathEl))),
        );
      }
    }
    return Promise.all(promises);
  }
}
