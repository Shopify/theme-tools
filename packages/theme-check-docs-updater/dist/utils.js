"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoize = exports.memo = exports.tap = exports.identity = exports.noop = void 0;
const noop = () => { };
exports.noop = noop;
const identity = (x) => x;
exports.identity = identity;
const tap = (tappingFunction) => {
    return (x) => {
        tappingFunction(x);
        return x;
    };
};
exports.tap = tap;
var theme_check_common_1 = require("@shopify/theme-check-common");
Object.defineProperty(exports, "memo", { enumerable: true, get: function () { return theme_check_common_1.memo; } });
Object.defineProperty(exports, "memoize", { enumerable: true, get: function () { return theme_check_common_1.memoize; } });
//# sourceMappingURL=utils.js.map