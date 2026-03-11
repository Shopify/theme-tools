"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePatchChangeset = void 0;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const utils_1 = require("../utils");
/**
 * Generate a patch changeset for a package.
 *
 * This is a workaround because we cannot use `changeset add` programmatically.
 *
 */
const generatePatchChangeset = async (pkgName, updatedDeps) => {
    const changesetId = (0, utils_1.getRandomId)(6);
    const changesetDir = path_1.default.resolve(await (0, utils_1.getRepoRoot)(), '.changeset');
    const changesetPath = path_1.default.join(changesetDir, `${changesetId}.md`);
    const depsDescription = updatedDeps.length === 1 ? ` ${updatedDeps[0]}` : `:\n - ${updatedDeps.join('\n - ')}`;
    const changesetContent = `---
"${pkgName}": patch
---

Patch bump because it depends on${depsDescription}
`;
    await promises_1.default.mkdir(changesetDir, { recursive: true });
    await promises_1.default.writeFile(changesetPath, changesetContent);
};
exports.generatePatchChangeset = generatePatchChangeset;
//# sourceMappingURL=generatePatchChangeset.js.map