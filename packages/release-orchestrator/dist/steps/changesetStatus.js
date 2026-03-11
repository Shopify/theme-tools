"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changesetStatus = void 0;
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
const changesetStatus = async () => {
    const basefile = `changeset-status.json`;
    try {
        await (0, utils_1.run)(`yarn changeset status --output=${basefile}`);
    }
    catch (err) {
        console.log('Failed to get changeset status. This should not be happening...');
        console.log('Exiting changeset version process.');
        console.log(err);
        process.exit(1);
    }
    const statusFilepath = path_1.default.join(await (0, utils_1.getRepoRoot)(), basefile);
    const statusOutput = JSON.parse(await (0, utils_1.readFile)(statusFilepath, 'utf-8'));
    // The output file compiles the status into a parsable object but we don't need it after that
    await (0, utils_1.run)(`rm ${statusFilepath}`);
    return statusOutput;
};
exports.changesetStatus = changesetStatus;
//# sourceMappingURL=changesetStatus.js.map