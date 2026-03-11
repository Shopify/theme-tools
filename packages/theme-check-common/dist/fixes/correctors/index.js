"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringCorrector = exports.JSONCorrector = void 0;
exports.createCorrector = createCorrector;
const types_1 = require("../../types");
const json_corrector_1 = require("./json-corrector");
Object.defineProperty(exports, "JSONCorrector", { enumerable: true, get: function () { return json_corrector_1.JSONCorrector; } });
const string_corrector_1 = require("./string-corrector");
Object.defineProperty(exports, "StringCorrector", { enumerable: true, get: function () { return string_corrector_1.StringCorrector; } });
function createCorrector(sourceCodeType, source) {
    switch (sourceCodeType) {
        case types_1.SourceCodeType.JSON: {
            return new json_corrector_1.JSONCorrector(source);
        }
        case types_1.SourceCodeType.LiquidHtml: {
            return new string_corrector_1.StringCorrector(source);
        }
        default: {
            return assertNever(sourceCodeType);
        }
    }
}
function assertNever(x) {
    throw new Error(`Case statement not exhausted: ${x}`);
}
//# sourceMappingURL=index.js.map