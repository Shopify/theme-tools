"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseExecuteCommandProvider = void 0;
class BaseExecuteCommandProvider {
    constructor(documentManager, diagnosticsManager, clientCapabilities, connection) {
        this.documentManager = documentManager;
        this.diagnosticsManager = diagnosticsManager;
        this.clientCapabilities = clientCapabilities;
        this.connection = connection;
    }
}
exports.BaseExecuteCommandProvider = BaseExecuteCommandProvider;
//# sourceMappingURL=BaseExecuteCommandProvider.js.map