import { vi } from 'vitest';
import { CancellationTokenSource, } from 'vscode-languageserver-protocol';
import { disposable } from '../LanguageClient';
export class MockClient extends EventTarget {
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
            return disposable(() => this.removeEventListener(type.method, callback));
        };
        this.onRequest = (type, handler) => {
            const cancellationToken = new CancellationTokenSource().token;
            const callback = (e) => handler(e.detail.params, cancellationToken);
            this.addEventListener(type.method, callback);
            return disposable(() => this.removeEventListener(type.method, callback));
        };
        this.sendRequest = vi.fn(async (_type, _params) => {
            this.pendingRequest = new Promise((resolve, reject) => {
                this.promiseCompletion = { resolve, reject };
            });
            return await this.pendingRequest;
        });
        this.sendNotification = vi.fn((_type, _params) => { });
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
//# sourceMappingURL=MockClient.js.map