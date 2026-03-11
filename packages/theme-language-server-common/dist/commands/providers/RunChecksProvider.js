"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunChecksProvider = void 0;
const BaseExecuteCommandProvider_1 = require("../BaseExecuteCommandProvider");
/**
 * The RunChecksProvider runs theme check on all open files.
 *
 * It is triggered by the cmd+p command in the VS Code extension and is
 * otherwise not used internally, which is why there is no
 * `runChecksCommand` method.
 *
 * This will be useful in a world where `checkOnSave`, `checkOnChange`,
 * `checkOnOpen` are all false.
 */
class RunChecksProvider extends BaseExecuteCommandProvider_1.BaseExecuteCommandProvider {
    constructor(documentManager, diagnosticsManager, clientCapabilities, connection, runChecks) {
        super(documentManager, diagnosticsManager, clientCapabilities, connection);
        this.documentManager = documentManager;
        this.diagnosticsManager = diagnosticsManager;
        this.clientCapabilities = clientCapabilities;
        this.connection = connection;
        this.runChecks = runChecks;
    }
    async execute() {
        const openDocuments = this.documentManager.openDocuments;
        const triggerURIs = openDocuments.map((sourceCode) => sourceCode.uri);
        this.runChecks(triggerURIs);
    }
}
exports.RunChecksProvider = RunChecksProvider;
RunChecksProvider.command = 'themeCheck/runChecks';
//# sourceMappingURL=RunChecksProvider.js.map