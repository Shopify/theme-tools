import type { AbstractFileSystem } from '@shopify/theme-check-common';
import { getConnection, NodeFileSystem, startServer } from '@shopify/theme-language-server-node';
import { CustomCheckPermissionRequest } from '@shopify/theme-language-server-common';
import { VsCodeFileSystem } from '../common/VsCodeFileSystem';

const connection = getConnection();

// When the URI starts with `file://`, we can use the NodeFileSystem directly (it's faster)
const fileSystems: Record<string, AbstractFileSystem> = {
  file: NodeFileSystem,
};

startServer(connection, new VsCodeFileSystem(connection, fileSystems), {
  authorizeCustomChecks: async (request) => {
    try {
      return await connection.sendRequest(CustomCheckPermissionRequest.type, request);
    } catch {
      return false;
    }
  },
});

process.on('uncaughtException', (e) => {
  console.error(e);
  debugger;
});

process.on('unhandledRejection', (e) => {
  console.error(e);
});
