(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "vscode-languageserver-protocol", "./client", "./textDocumentSync", "@codemirror/state", "@codemirror/view"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.lspHover = exports.hoverRendererFacet = void 0;
    exports.hover = hover;
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const client_1 = require("./client");
    const textDocumentSync_1 = require("./textDocumentSync");
    const state_1 = require("@codemirror/state");
    const view_1 = require("@codemirror/view");
    exports.hoverRendererFacet = state_1.Facet.define({
        static: true,
        combine: (values) => { var _a; return (_a = values[0]) !== null && _a !== void 0 ? _a : undefined; },
    });
    const lspHover = (overrides = {}) => (0, view_1.hoverTooltip)(hover, {
        ...overrides,
    });
    exports.lspHover = lspHover;
    async function hover(view, pos, _side) {
        const client = view.state.facet(client_1.clientFacet.reader);
        const fileUri = view.state.facet(client_1.fileUriFacet.reader);
        const hoverRenderer = view.state.facet(exports.hoverRendererFacet.reader);
        const textDocument = view.state.field(textDocumentSync_1.textDocumentField);
        if (!hoverRenderer)
            return null;
        const result = await client.sendRequest(vscode_languageserver_protocol_1.HoverRequest.type, {
            textDocument: { uri: fileUri },
            position: textDocument.positionAt(pos),
        });
        // No results
        if (result === null)
            return null;
        let { from, to, text } = view.state.doc.lineAt(pos);
        let start = pos;
        let end = pos;
        if (result.range) {
            start = textDocument.offsetAt(result.range.start);
            end = textDocument.offsetAt(result.range.end);
        }
        else {
            // basic "current word" algo
            while (start > from && /\w/.test(text[start - from - 1]))
                start--;
            while (end < to && /\w/.test(text[end - from]))
                end++;
        }
        return {
            pos: start,
            end: end,
            above: true,
            create: (view) => hoverRenderer(view, result),
            arrow: false,
        };
    }
});
//# sourceMappingURL=hover.js.map