"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnTypeFormattingProvider = void 0;
const BracketsAutoclosingOnTypeFormattingProvider_1 = require("./providers/BracketsAutoclosingOnTypeFormattingProvider");
const HtmlElementAutoclosingOnTypeFormattingProvider_1 = require("./providers/HtmlElementAutoclosingOnTypeFormattingProvider");
class OnTypeFormattingProvider {
    constructor(documentManager, setCursorPosition = async () => { }) {
        this.documentManager = documentManager;
        this.setCursorPosition = setCursorPosition;
        this.providers = [
            new BracketsAutoclosingOnTypeFormattingProvider_1.BracketsAutoclosingOnTypeFormattingProvider(),
            new HtmlElementAutoclosingOnTypeFormattingProvider_1.HtmlElementAutoclosingOnTypeFormattingProvider(setCursorPosition),
        ];
    }
    async onTypeFormatting(params) {
        var _a;
        const document = this.documentManager.get(params.textDocument.uri);
        if (!document)
            return null;
        const results = this.providers.map((provider) => provider.onTypeFormatting(document, params));
        return (_a = results.find((result) => result !== null)) !== null && _a !== void 0 ? _a : null;
    }
}
exports.OnTypeFormattingProvider = OnTypeFormattingProvider;
//# sourceMappingURL=OnTypeFormattingProvider.js.map