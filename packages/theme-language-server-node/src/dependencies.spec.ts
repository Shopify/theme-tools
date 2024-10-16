import { path as pathUtils } from '@shopify/theme-check-common';
import * as mktemp from 'mktemp';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { URI, Utils } from 'vscode-uri';
import { fileExists, filesForURI, findRootURI } from './dependencies';

type Tree = {
  [k in string]: Tree | string;
};

interface Workspace {
  root: string;
  path(relativePath: string): string;
  uri(relativePath: string): string;
  clean(): Promise<any>;
}

const theme = {
  locales: {
    'en.default.json': JSON.stringify({ beverage: 'coffee' }),
    'fr.json': '{}',
  },
  snippets: {
    'header.liquid': '',
  },
};

describe('Module: dependencies', () => {
  let workspace: Workspace;

  beforeAll(async () => {
    // We're intentionally not mocking here because we want to make sure
    // this works on Windows as well.
    workspace = await makeTempWorkspace({
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
          layout: {
            'theme.liquid': '',
          },
        },
      },
      frenchDefault: {
        '.theme-check.yml': '',
        ...theme,
        locales: {
          'fr.default.json': JSON.stringify({ beverage: 'café' }),
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
    });
  });

  afterAll(async () => {
    await workspace.clean();
  });

  describe('Unit: findRootURI', () => {
    it('should accurately return the root of a theme', async () => {
      expect(await findRootURI(workspace.uri('gitRootTheme'))).to.eql(
        workspace.uri('gitRootTheme'),
      );
      expect(await findRootURI(workspace.uri('gitRootTheme/snippets/header.liquid'))).to.eql(
        workspace.uri('gitRootTheme'),
      );
      expect(await findRootURI(workspace.uri('configRootTheme/snippets/header.liquid'))).to.eql(
        workspace.uri('configRootTheme'),
      );
      expect(await findRootURI(workspace.uri('multiRootTheme/dist/snippets/header.liquid'))).to.eql(
        workspace.uri('multiRootTheme'),
      );
      expect(await findRootURI(workspace.uri('multiRootTheme/src/snippets/header.liquid'))).to.eql(
        workspace.uri('multiRootTheme/src'),
      );
      expect(
        await findRootURI(
          workspace.uri(
            'appWithThemeAppExtension/extensions/myThemeAppExtension/snippets/header.liquid',
          ),
        ),
      ).to.eql(workspace.uri('appWithThemeAppExtension/extensions/myThemeAppExtension'));
    });
  });

  describe('Unit: filesForURI', () => {
    it('should return files in the format I expect them (even on windows)', async () => {
      expect(await filesForURI(workspace.uri('gitRootTheme/snippets/header.liquid'))).to.eql([
        'locales/en.default.json',
        'locales/fr.json',
        'snippets/header.liquid',
      ]);
      expect(await filesForURI(workspace.uri('multiRootTheme/src/snippets/header.liquid'))).to.eql([
        'layout/theme.liquid',
        'locales/en.default.json',
        'locales/fr.json',
        'snippets/header.liquid',
      ]);
      expect(await filesForURI(workspace.uri('multiRootTheme/dist/snippets/header.liquid'))).to.eql(
        ['locales/en.default.json', 'locales/fr.json', 'snippets/header.liquid'],
      );
    });
  });

  describe('Unit: fileExists', () => {
    it('should tell you if a file exists by path', async () => {
      expect(await fileExists(workspace.uri('gitRootTheme/snippets/header.liquid'))).to.be.true;
      expect(await fileExists(workspace.uri('gitRootTheme/snippets/does-not-exist.liquid'))).to.be
        .false;
    });

    it('should return true for directories', async () => {
      expect(await fileExists(workspace.uri('gitRootTheme/snippets'))).to.be.true;
    });

    it('should accurately return whether a file exists in workspace', async () => {
      // Create a temporary file
      const tempFilePath = path.join(workspace.root, 'temp.txt');
      const tempFileUri = pathUtils.normalize(URI.file(tempFilePath));
      await fs.writeFile(tempFilePath, 'Hello, world!', 'utf8');

      // Use the fileExists function to check if the file exists
      const exists = await fileExists(tempFileUri);

      // Check that the file exists
      expect(exists).to.be.true;

      // Delete the file
      await fs.unlink(tempFilePath);

      // Use the fileExists function to check if the file exists
      const notExists = await fileExists(tempFileUri);

      // Check that the file does not exist
      expect(notExists).to.be.false;
    });
  });
});

async function makeTempWorkspace(structure: Tree): Promise<Workspace> {
  const root = await mktemp.createDir(path.join(__dirname, '..', '.XXXXX'));
  if (!root) throw new Error('Could not create temp dir for temp workspace');
  const rootUri = URI.file(root);

  await createFiles(structure, [root]);

  return {
    root,
    path: (relativePath) => path.join(root, ...relativePath.split('/')),
    uri: (relativePath) => pathUtils.normalize(Utils.joinPath(rootUri, ...relativePath.split('/'))),
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
