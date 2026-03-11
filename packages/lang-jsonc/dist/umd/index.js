(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./jsonc", "./parser"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.parser = exports.jsoncLanguage = exports.jsonc = void 0;
    var jsonc_1 = require("./jsonc");
    Object.defineProperty(exports, "jsonc", { enumerable: true, get: function () { return jsonc_1.jsonc; } });
    Object.defineProperty(exports, "jsoncLanguage", { enumerable: true, get: function () { return jsonc_1.jsoncLanguage; } });
    var parser_1 = require("./parser");
    Object.defineProperty(exports, "parser", { enumerable: true, get: function () { return parser_1.parser; } });
});
//# sourceMappingURL=index.js.map