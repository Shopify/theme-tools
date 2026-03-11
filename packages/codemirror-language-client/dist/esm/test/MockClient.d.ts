import { ProtocolRequestType, ProtocolNotificationType } from 'vscode-languageserver-protocol';
import { AbstractLanguageClient } from '../LanguageClient';
export declare class MockClient extends EventTarget implements AbstractLanguageClient {
    clientCapabilities: AbstractLanguageClient['clientCapabilities'];
    serverCapabilities: AbstractLanguageClient['serverCapabilities'];
    serverInfo: AbstractLanguageClient['serverInfo'];
    onNotification: AbstractLanguageClient['onNotification'];
    onRequest: AbstractLanguageClient['onRequest'];
    sendNotification: AbstractLanguageClient['sendNotification'];
    sendRequest: AbstractLanguageClient['sendRequest'];
    pendingRequest: Promise<any> | null;
    private promiseCompletion;
    constructor(clientCapabilities?: {}, serverCapabilities?: AbstractLanguageClient['serverCapabilities'], serverInfo?: null);
    resolveRequest(value: any): void;
    rejectRequest(error: any): void;
    triggerNotification<P, RO>(type: ProtocolNotificationType<P, RO>, params: P): void;
    triggerRequest<P, R, PR, E, RO>(type: ProtocolRequestType<P, R, PR, E, RO>, params: P): void;
}
