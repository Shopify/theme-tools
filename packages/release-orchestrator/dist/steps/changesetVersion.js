"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changesetVersion = void 0;
const utils_1 = require("../utils");
const changesetVersion = async () => {
    console.log('Running `changeset version`...');
    console.log(await (0, utils_1.run)('yarn changeset version'));
};
exports.changesetVersion = changesetVersion;
//# sourceMappingURL=changesetVersion.js.map