import { startServer, getConnection, NodeFileSystem } from '@shopify/theme-language-server-node';
import { VsCodeFileSystem } from '../common/VsCodeFileSystem';
import type { AbstractFileSystem } from '@shopify/theme-check-common';

const connection = getConnection();

// When the URI starts with `file://`, we can use the NodeFileSystem directly (it's faster)
const fileSystems: Record<string, AbstractFileSystem> = {
  file: NodeFileSystem,
};

startServer(connection, new VsCodeFileSystem(connection, fileSystems));

process.on('uncaughtException', (e) => {
  console.error(e);
  debugger;
});

process.on('unhandledRejection', (e) => {
  console.error(e);
});
