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
    exports.simpleStateField = simpleStateField;
    const state_1 = require("@codemirror/state");
    /** Sometimes you don't want to repeat yourself for a simple state field. */
    function simpleStateField(stateEffect, defaultValue) {
        return state_1.StateField.define({
            create: () => defaultValue,
            update(value, tr) {
                let updatedValue = value;
                for (const effect of tr.effects) {
                    if (effect.is(stateEffect)) {
                        updatedValue = effect.value;
                    }
                }
                return updatedValue;
            },
        });
    }
});
//# sourceMappingURL=simpleStateField.js.map