import { findRoot, makeFileExists } from '@shopify/theme-check-common';
import {
  Dependencies,
  getConnection,
  recommendedChecks,
  startServer,
} from '@shopify/theme-language-server-browser';
import { VsCodeFileSystem } from '../common/VsCodeFileSystem';
import { ThemeDocsetManager } from './ThemeDocset';

const worker = self as any as Worker;
const connection = getConnection(worker);
const fileSystem = new VsCodeFileSystem(connection, {});
const themeDocset = new ThemeDocsetManager(connection);
const dependencies: Dependencies = {
  fs: fileSystem,
  log: console.info.bind(console),
  loadConfig: async (uri, fs) => {
    const fileExists = makeFileExists(fs);
    const rootUri = await findRoot(uri, fileExists);
    if (!rootUri) {
      throw new Error(`Could not find theme root for ${uri}`);
    }

    return {
      context: 'theme',
      settings: {},
      checks: recommendedChecks,
      rootUri,
    };
  },
  themeDocset: themeDocset,
  jsonValidationSet: themeDocset,
};

startServer(worker, dependencies, connection);
