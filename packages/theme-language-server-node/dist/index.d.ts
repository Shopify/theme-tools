import { AbstractFileSystem } from '@shopify/theme-check-node';
export { NodeFileSystem } from '@shopify/theme-check-node';
export * from '@shopify/theme-language-server-common';
export declare const getConnection: () => import("vscode-languageserver/node").Connection;
export declare function startServer(connection?: import("vscode-languageserver/node").Connection, fs?: AbstractFileSystem): void;
