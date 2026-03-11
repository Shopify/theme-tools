(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "@codemirror/state"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.serverCapabilitiesFacet = exports.fileUriFacet = exports.clientFacet = void 0;
    const state_1 = require("@codemirror/state");
    exports.clientFacet = state_1.Facet.define({
        combine: (values) => values[0],
        static: true,
    });
    exports.fileUriFacet = state_1.Facet.define({
        combine: (values) => values[0],
    });
    exports.serverCapabilitiesFacet = state_1.Facet.define({
        combine: (values) => { var _a; return (_a = values[0]) !== null && _a !== void 0 ? _a : {}; },
    });
});
//# sourceMappingURL=client.js.map