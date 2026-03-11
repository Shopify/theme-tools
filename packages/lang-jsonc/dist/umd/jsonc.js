(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./parser", "@codemirror/language"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.jsoncLanguage = void 0;
    exports.jsonc = jsonc;
    const parser_1 = require("./parser");
    const language_1 = require("@codemirror/language");
    /// A language provider that provides JSON parsing.
    exports.jsoncLanguage = language_1.LRLanguage.define({
        name: 'jsonc',
        parser: parser_1.parser.configure({
            props: [
                language_1.indentNodeProp.add({
                    Object: (0, language_1.continuedIndent)({ except: /^\s*\}/ }),
                    Array: (0, language_1.continuedIndent)({ except: /^\s*\]/ }),
                }),
                language_1.foldNodeProp.add({
                    'Object Array': language_1.foldInside,
                }),
            ],
        }),
        languageData: {
            closeBrackets: { brackets: ['[', '{', '"'] },
            indentOnInput: /^\s*[\}\]]$/,
        },
    });
    function jsonc() {
        return new language_1.LanguageSupport(exports.jsoncLanguage);
    }
});
//# sourceMappingURL=jsonc.js.map