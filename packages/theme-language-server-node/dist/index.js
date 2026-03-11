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
exports.getConnection = exports.NodeFileSystem = void 0;
exports.startServer = startServer;
const theme_check_docs_updater_1 = require("@shopify/theme-check-docs-updater");
const theme_check_node_1 = require("@shopify/theme-check-node");
const theme_language_server_common_1 = require("@shopify/theme-language-server-common");
const node_process_1 = require("node:process");
const node_1 = require("vscode-languageserver/node");
const dependencies_1 = require("./dependencies");
const metafieldDefinitions_1 = require("./metafieldDefinitions");
var theme_check_node_2 = require("@shopify/theme-check-node");
Object.defineProperty(exports, "NodeFileSystem", { enumerable: true, get: function () { return theme_check_node_2.NodeFileSystem; } });
__exportStar(require("@shopify/theme-language-server-common"), exports);
const getConnection = () => (0, node_1.createConnection)(node_process_1.stdin, node_process_1.stdout);
exports.getConnection = getConnection;
function startServer(connection = (0, exports.getConnection)(), fs = theme_check_node_1.NodeFileSystem) {
    // Using console.error to not interfere with messages sent on STDIN/OUT
    const log = (message) => console.error(message);
    const themeLiquidDocsManager = new theme_check_docs_updater_1.ThemeLiquidDocsManager(log);
    (0, theme_language_server_common_1.startServer)(connection, {
        fs,
        log,
        loadConfig: dependencies_1.loadConfig,
        themeDocset: themeLiquidDocsManager,
        jsonValidationSet: themeLiquidDocsManager,
        fetchMetafieldDefinitionsForURI: metafieldDefinitions_1.fetchMetafieldDefinitionsForURI,
    });
}
//# sourceMappingURL=index.js.map