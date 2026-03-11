import { Disposable, NotificationHandler, ProtocolNotificationType, ProtocolRequestType, ProtocolRequestType0, RequestHandler, ProtocolNotificationType0, ServerCapabilities, ClientCapabilities } from 'vscode-languageserver-protocol';
export interface PromiseCompletion {
    resolve(value: unknown): void;
    reject(error: unknown): void;
}
export interface Dependencies {
    clientCapabilities: ClientCapabilities;
    initializationOptions?: any;
    log(...args: any[]): void;
}
export interface AbstractLanguageClient {
    clientCapabilities: ClientCapabilities;
    serverCapabilities: ServerCapabilities | null;
    serverInfo: any;
    onRequest: LanguageClient['onRequest'];
    onNotification: LanguageClient['onNotification'];
    sendRequest: LanguageClient['sendRequest'];
    sendNotification: LanguageClient['sendNotification'];
}
export declare class LanguageClient extends EventTarget implements AbstractLanguageClient {
    readonly worker: Worker;
    readonly clientCapabilities: ClientCapabilities;
    readonly initializationOptions: any;
    serverCapabilities: ServerCapabilities | null;
    serverInfo: any;
    private requestId;
    private requests;
    private dispose;
    private disposables;
    private log;
    constructor(worker: Worker, dependencies: Dependencies);
    /**
     * Lifecycle method to start the server
     */
    start(): Promise<void>;
    /**
     * Lifecycle method to stop the server
     */
    stop(): Promise<void>;
    /**
     * For when you want to handle requests sent from the language server.
     *
     * @param {MessageSignature} type this is an export from vscode-languageserver-protocol
     * @param {RequestHandler} handler a type-inferred event handler whose return value matches the MessageSignature
     *
     * @example
     * import {ApplyWorkspaceEditRequest, ApplyWorkspaceEditResponse} from 'vscode-languageserver-protocol';
     * client.onRequest(ApplyWorkspaceEditRequest.type, (params, cancellationToken) => {
     *   // `params` and `cancellationToken` are typed inferred
     *   // The return value must match the MessageSignature (ApplyWorkspaceEditResponse)
     *   return result as ApplyWorkspaceEditResponse;
     * })
     */
    onRequest<P, R, PR, E, RO>(type: ProtocolRequestType<P, R, PR, E, RO>, handler: RequestHandler<P, R, E>): Disposable;
    /**
     * For when you want to handle notifications sent from the language server.
     *
     * @param {MessageSignature} type this is an export from vscode-languageserver-protocol
     * @param {NotificationHandler} handler this is a type-inferred event handler
     *
     * @example
     * import {PublishDiagnosticsNotification} from 'vscode-languageserver-protocol';
     * client.onNotification(PublishDiagnosticsNotification.type, (params) => {
     *   // the type of `params` is inferred from the first argument
     * });
     */
    onNotification<P, RO>(type: ProtocolNotificationType<P, RO>, handler: NotificationHandler<P>): Disposable;
    /**
     * Send a request to the language server and await a response.
     *
     * @param {MessageSignature} type this is an export from vscode-languageserver-protocol
     * @param [params] its type is inferred from the first argument
     * @returns {any} response, its type is inferred from the first argument
     *
     * @example
     *
     * import {CompletionRequest} from 'vscode-languageserver-protocol';
     * const completions = await client.sendRequest(
     *   CompletionRequest.type,
     *   params
     * );
     */
    sendRequest<R, PR, E, RO>(type: ProtocolRequestType0<R, PR, E, RO>): Promise<R>;
    sendRequest<P, R, PR, E, RO>(type: ProtocolRequestType<P, R, PR, E, RO>, params?: P): Promise<R>;
    /**
     * Send a notification to the language server. Notifications are fire and forget.
     *
     * @param {MessageSignature} type this is an export from vscode-languageserver-protocol
     * @param [params] its type is inferred from the first argument
     *
     * @example
     *
     * import {DidChangeTextDocumentNotification} from 'vscode-languageserver-protocol';
     * client.sendNotification(
     *   DidChangeTextDocumentNotification.type,
     *   params
     * );
     */
    sendNotification<RO>(type: ProtocolNotificationType0<RO>): void;
    sendNotification<P, RO>(type: ProtocolNotificationType<P, RO>, params?: P): void;
    private sendResponse;
    private sendMessage;
    /**
     * Map messages to their correct destition.
     *  - Responses -> resolve or reject the corresponding Request
     *  - Notification -> emit(message.method, message)
     *  - Request -> emit(message.method, message)
     */
    private handleMessage;
    private disposable;
}
export declare function disposable(dispose: () => void): Disposable;
