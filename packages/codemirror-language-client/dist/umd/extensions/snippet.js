(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.translateSnippet = translateSnippet;
    /**
     * This function takes a snippet from the language server and transforms it
     * into the format that CodeMirror expects.
     *
     * There are small nuances w.r.t. $0 but that shouldn't be too much of a
     * problem. ($0 is the "end" cursor position in LSP, CM doesn't have that... so
     * we convert $0 to ${99} :D)
     */
    function translateSnippet(snippet) {
        let fixed = snippet.replace(/\$(\d)+/g, (_match, index) => {
            return '${' + (Number(index) === 0 ? '99' : index) + '}';
        });
        // Remove references to other placeholders in placeholders. CodeMirror doesn't
        // support those and it's a PITA to implement differently.
        fixed = fixed.replace(/\$\{(\d+):([^}$]*)(\$\{\d+\})([^}$]*)\}/g, (_match, index, pre, ref, post) => {
            return '${' + index + ':' + pre + post + '}';
        });
        if (fixed.includes('${99}')) {
            return fixed;
        }
        else {
            return fixed + '${99}';
        }
    }
});
//# sourceMappingURL=snippet.js.map