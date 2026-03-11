"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeActionsProvider = exports.CodeActionKinds = void 0;
const providers_1 = require("./providers");
exports.CodeActionKinds = Array.from(new Set([providers_1.FixAllProvider.kind, providers_1.FixProvider.kind, providers_1.SuggestionProvider.kind]));
class CodeActionsProvider {
    constructor(documentManager, diagnosticsManager) {
        this.providers = [
            new providers_1.FixAllProvider(documentManager, diagnosticsManager),
            new providers_1.FixProvider(documentManager, diagnosticsManager),
            new providers_1.SuggestionProvider(documentManager, diagnosticsManager),
        ];
    }
    codeActions(params) {
        const only = params.context.only;
        return this.providers
            .filter((provider) => !only || only.some((kind) => provider.kind.startsWith(kind)))
            .flatMap((provider) => provider.codeActions(params));
    }
}
exports.CodeActionsProvider = CodeActionsProvider;
//# sourceMappingURL=CodeActionsProvider.js.map