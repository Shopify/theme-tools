(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "vscode-languageserver-protocol"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LanguageClient = void 0;
    exports.disposable = disposable;
    /* eslint-disable lines-between-class-members */
    const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    class LanguageClient extends EventTarget {
        constructor(worker, dependencies) {
            super();
            this.worker = worker;
            this.requests = new Map();
            this.requestId = 0;
            this.dispose = () => { };
            this.disposables = [];
            this.clientCapabilities = dependencies.clientCapabilities;
            this.initializationOptions = dependencies.initializationOptions;
            this.log = dependencies.log;
            this.serverCapabilities = null;
            this.serverInfo = null;
        }
        /**
         * Lifecycle method to start the server
         */
        async start() {
            /**
             * Here we setup the web worker event handler.
             * We route the message sent via the worker's postMessage to our event handler.
             */
            const handler = (ev) => this.handleMessage(ev.data);
            this.worker.addEventListener('message', handler);
            this.dispose = () => {
                this.worker.removeEventListener('message', handler);
            };
            /**
             * We send the `initialize` request and obtain the capabilities supported by
             * the language server.
             *
             * https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#initialize
             */
            const response = await this.sendRequest(vscode_languageserver_protocol_1.InitializeRequest.type, {
                capabilities: this.clientCapabilities,
                initializationOptions: this.initializationOptions,
                processId: 0,
                rootUri: 'browser:///',
            });
            /**
             * We unpack the response from the server and remember the capabilities.
             * Those will be useful.
             */
            this.serverCapabilities = response.capabilities;
            this.serverInfo = response.serverInfo;
            /**
             * Once we're ready, we send the `initialized` notification to tell the
             * server that we're ready to roll!
             *
             * https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#initialized
             */
            this.sendNotification(vscode_languageserver_protocol_1.InitializedNotification.type, {});
        }
        /**
         * Lifecycle method to stop the server
         */
        async stop() {
            await Promise.race([this.sendRequest(vscode_languageserver_protocol_1.ShutdownRequest.type), sleep(1000)]);
            this.disposables.forEach((disposable) => disposable.dispose());
            this.disposables = [];
            this.dispose();
            this.sendNotification(vscode_languageserver_protocol_1.ExitNotification.type);
        }
        onRequest(type, handler) {
            const method = typeof type === 'string' ? type : type.method;
            const callback = async (event) => {
                const { params, id } = event.detail;
                const cancellationToken = new vscode_languageserver_protocol_1.CancellationTokenSource().token;
                try {
                    const response = await handler(params, cancellationToken);
                    if (response && typeof response === 'object' && 'code' in response) {
                        this.sendResponse(id, undefined, response);
                    }
                    else {
                        this.sendResponse(id, response, undefined);
                    }
                }
                catch (error) {
                    this.sendResponse(id, undefined, new vscode_languageserver_protocol_1.ResponseError(1, error instanceof Error ? error.message : error));
                }
            };
            this.addEventListener(method, callback);
            return this.disposable(() => this.removeEventListener(method, callback));
        }
        onNotification(type, handler) {
            const method = typeof type === 'string' ? type : type.method;
            const callback = (event) => {
                const { params } = event.detail;
                handler(params);
            };
            this.addEventListener(method, callback);
            return this.disposable(() => this.removeEventListener(method, callback));
        }
        async sendRequest(type, params) {
            this.requestId += 1;
            const requestId = this.requestId;
            const method = typeof type === 'string' ? type : type.method;
            const request = {
                jsonrpc: '2.0',
                id: requestId,
                method,
            };
            if (params)
                request.params = params;
            this.log(`Client->Server ${request.method} request [${request.id}]`, request);
            this.sendMessage(request);
            return new Promise((resolve, reject) => {
                this.requests.set(requestId.toString(), { resolve, reject });
            });
        }
        sendNotification(type, params) {
            const method = typeof type === 'string' ? type : type.method;
            const notification = {
                jsonrpc: '2.0',
                method,
            };
            if (params)
                notification.params = params;
            this.log(`Client->Server ${method} notification`, notification);
            this.sendMessage(notification);
        }
        sendResponse(id, result, error) {
            const response = { jsonrpc: '2.0', id };
            if (result !== undefined)
                response.result = result;
            if (error !== undefined)
                response.error = error.toJson();
            this.log(`Client->Server response [${id}]`, response);
            this.sendMessage(response);
        }
        sendMessage(message) {
            this.worker.postMessage(message);
        }
        /**
         * Map messages to their correct destition.
         *  - Responses -> resolve or reject the corresponding Request
         *  - Notification -> emit(message.method, message)
         *  - Request -> emit(message.method, message)
         */
        handleMessage(message) {
            if (isResponse(message)) {
                this.log(`Server->Client response [${message.id}]`, message);
                const id = message.id.toString();
                if ('result' in message) {
                    this.requests.get(id).resolve(message.result);
                }
                else {
                    this.requests.get(id).reject(message.error);
                }
                this.requests.delete(id);
            }
            else if (isRequest(message)) {
                this.log(`Server->Client ${message.method} request [${message.id}]`, message);
                this.dispatchEvent(new CustomEvent(message.method, { detail: message }));
            }
            else if (isNotification(message)) {
                this.log(`Server->Client ${message.method} notification`, message);
                this.dispatchEvent(new CustomEvent(message.method, {
                    detail: message,
                }));
            }
            else {
                this.log('what?', message);
            }
        }
        disposable(dispose) {
            const disp = disposable(dispose);
            this.disposables.push(disp);
            return disp;
        }
    }
    exports.LanguageClient = LanguageClient;
    function disposable(dispose) {
        return { dispose };
    }
    function isResponse(message) {
        return 'id' in message && ('error' in message || 'result' in message);
    }
    function isRequest(message) {
        return 'id' in message && 'method' in message;
    }
    function isNotification(message) {
        return !('id' in message) && 'method' in message;
    }
});
//# sourceMappingURL=LanguageClient.js.map