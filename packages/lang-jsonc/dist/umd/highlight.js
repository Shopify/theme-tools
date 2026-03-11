(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "@lezer/highlight"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.jsonHighlighting = void 0;
    const highlight_1 = require("@lezer/highlight");
    exports.jsonHighlighting = (0, highlight_1.styleTags)({
        String: highlight_1.tags.string,
        Number: highlight_1.tags.number,
        'True False': highlight_1.tags.bool,
        PropertyName: highlight_1.tags.propertyName,
        Null: highlight_1.tags.null,
        ',': highlight_1.tags.separator,
        '[ ]': highlight_1.tags.squareBracket,
        '{ }': highlight_1.tags.brace,
        LineComment: highlight_1.tags.lineComment,
        BlockComment: highlight_1.tags.blockComment,
    });
});
//# sourceMappingURL=highlight.js.map