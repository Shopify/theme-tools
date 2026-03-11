"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteCommandProvider = exports.Commands = void 0;
const providers_1 = require("./providers");
exports.Commands = [
    providers_1.ApplyFixesProvider.command,
    providers_1.ApplySuggestionProvider.command,
    providers_1.RunChecksProvider.command,
];
function isKnownCommand(command) {
    return exports.Commands.includes(command);
}
class ExecuteCommandProvider {
    constructor(documentManager, diagnosticsManager, clientCapabilities, runChecks, connection) {
        this.commands = {
            [providers_1.ApplyFixesProvider.command]: new providers_1.ApplyFixesProvider(documentManager, diagnosticsManager, clientCapabilities, connection),
            [providers_1.ApplySuggestionProvider.command]: new providers_1.ApplySuggestionProvider(documentManager, diagnosticsManager, clientCapabilities, connection),
            [providers_1.RunChecksProvider.command]: new providers_1.RunChecksProvider(documentManager, diagnosticsManager, clientCapabilities, connection, runChecks),
        };
    }
    async execute(params) {
        var _a;
        if (!isKnownCommand(params.command))
            return;
        const provider = this.commands[params.command];
        const args = (_a = params.arguments) !== null && _a !== void 0 ? _a : [];
        await provider.execute(...args);
    }
}
exports.ExecuteCommandProvider = ExecuteCommandProvider;
//# sourceMappingURL=ExecuteCommandProvider.js.map