"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFixToString = exports.autofix = exports.createCorrector = exports.JSONCorrector = exports.StringCorrector = exports.flattenFixes = void 0;
var utils_1 = require("./utils");
Object.defineProperty(exports, "flattenFixes", { enumerable: true, get: function () { return utils_1.flattenFixes; } });
var correctors_1 = require("./correctors");
Object.defineProperty(exports, "StringCorrector", { enumerable: true, get: function () { return correctors_1.StringCorrector; } });
Object.defineProperty(exports, "JSONCorrector", { enumerable: true, get: function () { return correctors_1.JSONCorrector; } });
Object.defineProperty(exports, "createCorrector", { enumerable: true, get: function () { return correctors_1.createCorrector; } });
var autofix_1 = require("./autofix");
Object.defineProperty(exports, "autofix", { enumerable: true, get: function () { return autofix_1.autofix; } });
var apply_fix_to_string_1 = require("./apply-fix-to-string");
Object.defineProperty(exports, "applyFixToString", { enumerable: true, get: function () { return apply_fix_to_string_1.applyFixToString; } });
//# sourceMappingURL=index.js.map