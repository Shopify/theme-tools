"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const node_path_1 = __importDefault(require("node:path"));
async function main() {
    const root = node_path_1.default.resolve(process.argv[2]);
    const configPath = process.argv[3] ? node_path_1.default.resolve(process.argv[3]) : undefined;
    const { theme, config, offenses } = await (0, index_1.themeCheckRun)(root, configPath, console.error.bind(console));
    console.log(JSON.stringify(offenses, null, 2));
    console.log(JSON.stringify(config, null, 2));
    console.log(JSON.stringify(theme.map((x) => x.uri), null, 2));
}
main();
//# sourceMappingURL=cli.js.map