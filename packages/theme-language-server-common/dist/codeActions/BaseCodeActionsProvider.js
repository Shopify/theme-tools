"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCodeActionsProvider = void 0;
class BaseCodeActionsProvider {
    constructor(documentManager, diagnosticsManager) {
        this.documentManager = documentManager;
        this.diagnosticsManager = diagnosticsManager;
    }
    get kind() {
        return this.constructor.kind;
    }
}
exports.BaseCodeActionsProvider = BaseCodeActionsProvider;
//# sourceMappingURL=BaseCodeActionsProvider.js.map