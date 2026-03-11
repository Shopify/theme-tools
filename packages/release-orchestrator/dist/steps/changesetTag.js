"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changesetTag = void 0;
const utils_1 = require("../utils");
const changesetTag = async () => {
    console.log('Creating git tags for package versions...');
    console.log(await (0, utils_1.run)('yarn changeset tag'));
};
exports.changesetTag = changesetTag;
//# sourceMappingURL=changesetTag.js.map