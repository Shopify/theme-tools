import type { AbstractFileSystem } from '@shopify/theme-check-common';
import { getConnection, NodeFileSystem, startServer } from '@shopify/theme-language-server-node';
import { VsCodeFileSystem } from '../common/VsCodeFileSystem';
import { fetchMetafieldDefinitions } from './metafieldDefinitions';

const connection = getConnection();

// When the URI starts with `file://`, we can use the NodeFileSystem directly (it's faster)
const fileSystems: Record<string, AbstractFileSystem> = {
  file: NodeFileSystem,
};

startServer(connection, new VsCodeFileSystem(connection, fileSystems));
fetchMetafieldDefinitions();

process.on('uncaughtException', (e) => {
  console.error(e);
  debugger;
});

process.on('unhandledRejection', (e) => {
  console.error(e);
});
