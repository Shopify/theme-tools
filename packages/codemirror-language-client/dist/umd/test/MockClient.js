(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "vitest", "vscode-languageserver-protocol", "../LanguageClient"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MockClient = void 0;
    const vitest_1 = require("vitest");
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const LanguageClient_1 = require("../LanguageClient");
    class MockClient extends EventTarget {
        constructor(clientCapabilities = {}, serverCapabilities = null, serverInfo = null) {
            super();
            this.clientCapabilities = clientCapabilities;
            this.serverCapabilities = serverCapabilities;
            this.serverInfo = serverInfo;
            this.pendingRequest = null;
            this.promiseCompletion = null;
            this.onNotification = (type, handler) => {
                const callback = (e) => handler(e.detail.params);
                this.addEventListener(type.method, callback);
                return (0, LanguageClient_1.disposable)(() => this.removeEventListener(type.method, callback));
            };
            this.onRequest = (type, handler) => {
                const cancellationToken = new vscode_languageserver_protocol_1.CancellationTokenSource().token;
                const callback = (e) => handler(e.detail.params, cancellationToken);
                this.addEventListener(type.method, callback);
                return (0, LanguageClient_1.disposable)(() => this.removeEventListener(type.method, callback));
            };
            this.sendRequest = vitest_1.vi.fn(async (_type, _params) => {
                this.pendingRequest = new Promise((resolve, reject) => {
                    this.promiseCompletion = { resolve, reject };
                });
                return await this.pendingRequest;
            });
            this.sendNotification = vitest_1.vi.fn((_type, _params) => { });
        }
        resolveRequest(value) {
            if (!this.promiseCompletion)
                throw Error('Expecting a pending request');
            this.promiseCompletion.resolve(value);
            this.pendingRequest = null;
        }
        rejectRequest(error) {
            if (!this.promiseCompletion)
                throw Error('Expecting a pending request');
            this.promiseCompletion.reject(error);
            this.pendingRequest = null;
        }
        triggerNotification(type, params) {
            this.dispatchEvent(new CustomEvent(type.method, {
                detail: {
                    jsonrpc: '2.0',
                    method: type.method,
                    params,
                },
            }));
        }
        triggerRequest(type, params) {
            this.dispatchEvent(new CustomEvent(type.method, {
                detail: {
                    jsonrpc: '2.0',
                    requestId: 0,
                    method: type.method,
                    params,
                },
            }));
        }
    }
    exports.MockClient = MockClient;
});
//# sourceMappingURL=MockClient.js.map