"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const changesetVersion_1 = require("./steps/changesetVersion");
const getPackageJsonPaths_1 = require("./steps/getPackageJsonPaths");
const getPackageJsonRecord_1 = require("./steps/getPackageJsonRecord");
const writeDependentPatchChangesets_1 = require("./steps/writeDependentPatchChangesets");
const utils_1 = require("./utils");
const main = async () => {
    const steps = [
        getPackageJsonPaths_1.getPackageJsonPaths,
        getPackageJsonRecord_1.getPackageJsonRecord,
        writeDependentPatchChangesets_1.writeDependentPatchChangesets,
        changesetVersion_1.changesetVersion,
    ];
    const startRelease = (0, utils_1.flow)(steps);
    try {
        await startRelease();
    }
    catch (err) {
        process.exit(1);
    }
};
main();
//# sourceMappingURL=index.js.map