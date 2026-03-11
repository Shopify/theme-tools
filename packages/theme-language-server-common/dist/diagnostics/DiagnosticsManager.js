"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsManager = void 0;
const offenseToDiagnostic_1 = require("./offenseToDiagnostic");
class DiagnosticsManager {
    constructor(connection) {
        this.connection = connection;
        this.diagnostics = new Map();
    }
    get(uri) {
        return this.diagnostics.get(uri);
    }
    set(uri, version, offenses) {
        const anomalies = offenses.map((offense, index) => ({
            offense,
            diagnostic: (0, offenseToDiagnostic_1.offenseToDiagnostic)(offense),
            id: index,
        }));
        this.diagnostics.set(uri, {
            uri,
            version,
            anomalies,
        });
        this.connection.sendDiagnostics({
            uri,
            version,
            diagnostics: anomalies.map((a) => a.diagnostic),
        });
    }
    clear(uri) {
        this.diagnostics.delete(uri);
        this.connection.sendDiagnostics({
            uri,
            version: undefined,
            diagnostics: [],
        });
    }
}
exports.DiagnosticsManager = DiagnosticsManager;
//# sourceMappingURL=DiagnosticsManager.js.map