"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.thisNodeModuleRoot = void 0;
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = __importDefault(require("node:os"));
// This is used to load global checks (in the context where someone installed the CLI globally)
// This shouldn't be used by VS Code since it's baked into the extension with webpack.
const thisNodeModuleRoot = () => {
    if (process.env.WEBPACK_MODE) {
        return node_os_1.default.tmpdir();
    }
    else {
        return node_path_1.default.resolve(node_path_1.default.join(__dirname, '..', '..'));
    }
};
exports.thisNodeModuleRoot = thisNodeModuleRoot;
//# sourceMappingURL=installation-location.js.map