"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnection = getConnection;
exports.startServer = startServer;
const theme_language_server_common_1 = require("@shopify/theme-language-server-common");
const browser_1 = require("vscode-languageserver/browser");
__exportStar(require("@shopify/theme-language-server-common"), exports);
function getConnection(worker) {
    const reader = new browser_1.BrowserMessageReader(worker);
    const writer = new browser_1.BrowserMessageWriter(worker);
    return (0, browser_1.createConnection)(reader, writer);
}
// This is where you do the worker.postMessage stuff?
// Or is this where we accept the worker.postMessage stuff?
// Yeah I think this is where you _accept_ the worker.postMessage stuff
function startServer(worker, dependencies, connection = getConnection(worker)) {
    (0, theme_language_server_common_1.startServer)(connection, dependencies);
}
//# sourceMappingURL=index.js.map