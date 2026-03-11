import { Dependencies } from '@shopify/theme-language-server-common';
export * from '@shopify/theme-language-server-common';
export declare function getConnection(worker: Worker): import("vscode-languageserver/browser").Connection;
export declare function startServer(worker: Worker, dependencies: Dependencies, connection?: import("vscode-languageserver/browser").Connection): void;
