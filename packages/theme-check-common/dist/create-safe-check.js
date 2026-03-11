"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSafeCheck = createSafeCheck;
const resolve = () => Promise.resolve(undefined);
const handleMissingMethod = {
    get(target, prop) {
        if (!(prop in target))
            return resolve;
        return target[prop];
    },
};
function createSafeCheck(check) {
    return new Proxy(check, handleMissingMethod);
}
//# sourceMappingURL=create-safe-check.js.map