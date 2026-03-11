(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "./client", "./complete", "./documentHighlights", "./hover", "./lspLinter", "./textDocumentSync"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.textDocumentSync = exports.textDocumentField = exports.lspLinter = exports.lspDiagnosticsField = exports.diagnosticsFacet = exports.diagnosticRendererFacet = exports.lspHover = exports.hover = exports.lspDocumentHighlights = exports.documentHighlightsClass = exports.lspComplete = exports.infoRendererFacet = exports.complete = exports.serverCapabilitiesFacet = exports.fileUriFacet = exports.clientFacet = void 0;
    var client_1 = require("./client");
    Object.defineProperty(exports, "clientFacet", { enumerable: true, get: function () { return client_1.clientFacet; } });
    Object.defineProperty(exports, "fileUriFacet", { enumerable: true, get: function () { return client_1.fileUriFacet; } });
    Object.defineProperty(exports, "serverCapabilitiesFacet", { enumerable: true, get: function () { return client_1.serverCapabilitiesFacet; } });
    var complete_1 = require("./complete");
    Object.defineProperty(exports, "complete", { enumerable: true, get: function () { return complete_1.complete; } });
    Object.defineProperty(exports, "infoRendererFacet", { enumerable: true, get: function () { return complete_1.infoRendererFacet; } });
    Object.defineProperty(exports, "lspComplete", { enumerable: true, get: function () { return complete_1.lspComplete; } });
    var documentHighlights_1 = require("./documentHighlights");
    Object.defineProperty(exports, "documentHighlightsClass", { enumerable: true, get: function () { return documentHighlights_1.documentHighlightsClass; } });
    Object.defineProperty(exports, "lspDocumentHighlights", { enumerable: true, get: function () { return documentHighlights_1.lspDocumentHighlights; } });
    var hover_1 = require("./hover");
    Object.defineProperty(exports, "hover", { enumerable: true, get: function () { return hover_1.hover; } });
    Object.defineProperty(exports, "lspHover", { enumerable: true, get: function () { return hover_1.lspHover; } });
    var lspLinter_1 = require("./lspLinter");
    Object.defineProperty(exports, "diagnosticRendererFacet", { enumerable: true, get: function () { return lspLinter_1.diagnosticRendererFacet; } });
    Object.defineProperty(exports, "diagnosticsFacet", { enumerable: true, get: function () { return lspLinter_1.diagnosticsFacet; } });
    Object.defineProperty(exports, "lspDiagnosticsField", { enumerable: true, get: function () { return lspLinter_1.lspDiagnosticsField; } });
    Object.defineProperty(exports, "lspLinter", { enumerable: true, get: function () { return lspLinter_1.lspLinter; } });
    var textDocumentSync_1 = require("./textDocumentSync");
    Object.defineProperty(exports, "textDocumentField", { enumerable: true, get: function () { return textDocumentSync_1.textDocumentField; } });
    Object.defineProperty(exports, "textDocumentSync", { enumerable: true, get: function () { return textDocumentSync_1.textDocumentSync; } });
});
//# sourceMappingURL=index.js.map