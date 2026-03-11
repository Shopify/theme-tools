"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Progress = void 0;
exports.percent = percent;
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
/**
 * A short hand for handling progress reporting to the language client.
 *
 * It handles all the LSP protocol details for you.
 *
 * @example
 * const progress = Progress.create(connection, capabilities, progressToken);
 * await progress.start('Starting progress');
 * await progress.report(50, 'Halfway there');
 * await progress.end('Finished');
 */
class Progress {
    constructor(connection, progressToken) {
        this.connection = connection;
        this.progressToken = progressToken;
    }
    static create(connection, capabilities, progressToken) {
        if (!connection || !capabilities || !capabilities.hasProgressSupport) {
            // If you don't have a connection, we give you a mock that doesn't do anything.
            return {
                start: async () => { },
                report: async () => { },
                end: async () => { },
            };
        }
        return new Progress(connection, progressToken);
    }
    async start(title) {
        await this.connection.sendRequest(vscode_languageserver_protocol_1.WorkDoneProgressCreateRequest.type, {
            token: this.progressToken,
        });
        await this.connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this.progressToken, {
            kind: 'begin',
            title,
        });
    }
    async report(percentage, message) {
        await this.connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this.progressToken, {
            kind: 'report',
            message,
            percentage,
        });
    }
    async end(message) {
        await this.connection.sendProgress(vscode_languageserver_protocol_1.WorkDoneProgress.type, this.progressToken, {
            kind: 'end',
            message,
        });
    }
}
exports.Progress = Progress;
/**
 * Given a current/total and an offset, report the percent complete
 * @param current - number of items processed from total
 * @param total   - total number of items
 * @param offset  - offset % to start at
 *
 * @example
 * const offset = 50 // Start at 50%
 * const current = 0
 * const total = 100 // files or whatever
 * percent(0, total, offset)   // 50 %
 * percent(50, total, offset)  // 75 %
 * percent(100, total, offset) // 100 %
 */
function percent(current, total, offset = 0) {
    return Math.round(offset + (current / total) * (100 - offset));
}
//# sourceMappingURL=progress.js.map