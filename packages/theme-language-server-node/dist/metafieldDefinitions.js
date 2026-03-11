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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchMetafieldDefinitionsForURI = fetchMetafieldDefinitionsForURI;
const child_process = __importStar(require("child_process"));
const node_util_1 = require("node:util");
const exec = (0, node_util_1.promisify)(child_process.exec);
const isWin = process.platform === 'win32';
const shopifyCliPathPromise = getShopifyCliPath();
async function fetchMetafieldDefinitionsForURI(uri) {
    try {
        const path = await shopifyCliPathPromise;
        if (!path) {
            return;
        }
        await exec(`${path} theme metafields pull`, {
            cwd: new URL(uri),
            timeout: 10000,
            env: {
                ...process.env,
                SHOPIFY_LANGUAGE_SERVER: '1',
            },
        });
    }
    catch (_) {
        // CLI command can break because of incorrect version or not being logged in
        // If this fails, the user must fetch their own metafield definitions
    }
}
async function getShopifyCliPath() {
    if (process.env.NODE_ENV === 'test') {
        return;
    }
    try {
        if (isWin) {
            const { stdout } = await exec(`where.exe shopify`);
            const executables = stdout
                .replace(/\r/g, '')
                .split('\n')
                .filter((exe) => exe.endsWith('bat'));
            return executables.length > 0 ? executables[0] : '';
        }
        else {
            const { stdout } = await exec(`which shopify`);
            return stdout.split('\n')[0].replace('\r', '');
        }
    }
    catch (_) {
        // If any errors occur while trying to find the CLI, we will silently return
        return;
    }
}
//# sourceMappingURL=metafieldDefinitions.js.map