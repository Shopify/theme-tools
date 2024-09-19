import { vi } from 'vitest';
import {
  ProtocolRequestType,
  ProtocolNotificationType,
  CancellationTokenSource,
  CancellationToken,
  ServerCapabilities,
} from 'vscode-languageserver-protocol';
import { PromiseCompletion, AbstractLanguageClient, disposable } from '../LanguageClient';

export class MockClient extends EventTarget implements AbstractLanguageClient {
  clientCapabilities: AbstractLanguageClient['clientCapabilities'];
  serverCapabilities: AbstractLanguageClient['serverCapabilities'];
  serverInfo: AbstractLanguageClient['serverInfo'];

  // I'm too lazy to copy the types for this stuff.
  onNotification: AbstractLanguageClient['onNotification'];
  onRequest: AbstractLanguageClient['onRequest'];
  sendNotification: AbstractLanguageClient['sendNotification'];
  sendRequest: AbstractLanguageClient['sendRequest'];

  public pendingRequest: Promise<any> | null;
  private promiseCompletion: PromiseCompletion | null;

  constructor(
    clientCapabilities = {},
    serverCapabilities: AbstractLanguageClient['serverCapabilities'] = null,
    serverInfo = null,
  ) {
    super();
    this.clientCapabilities = clientCapabilities;
    this.serverCapabilities = serverCapabilities;
    this.serverInfo = serverInfo;
    this.pendingRequest = null;
    this.promiseCompletion = null;

    this.onNotification = (type, handler) => {
      const callback = (e: any) => handler(e.detail.params);
      this.addEventListener(type.method, callback);
      return disposable(() => this.removeEventListener(type.method, callback));
    };

    this.onRequest = (type, handler) => {
      const cancellationToken: CancellationToken = new CancellationTokenSource().token;
      const callback = (e: any) => handler(e.detail.params, cancellationToken);
      this.addEventListener(type.method, callback);
      return disposable(() => this.removeEventListener(type.method, callback));
    };

    this.sendRequest = vi.fn(async (_type, _params) => {
      this.pendingRequest = new Promise((resolve, reject) => {
        this.promiseCompletion = { resolve, reject };
      });
      return await this.pendingRequest;
    }) as any;

    this.sendNotification = vi.fn((_type, _params) => {}) as any;
  }

  resolveRequest(value: any) {
    if (!this.promiseCompletion) throw Error('Expecting a pending request');
    this.promiseCompletion.resolve(value);
    this.pendingRequest = null;
  }

  rejectRequest(error: any) {
    if (!this.promiseCompletion) throw Error('Expecting a pending request');
    this.promiseCompletion.reject(error);
    this.pendingRequest = null;
  }

  triggerNotification<P, RO>(type: ProtocolNotificationType<P, RO>, params: P) {
    this.dispatchEvent(
      new CustomEvent(type.method, {
        detail: {
          jsonrpc: '2.0',
          method: type.method,
          params,
        },
      }),
    );
  }

  triggerRequest<P, R, PR, E, RO>(type: ProtocolRequestType<P, R, PR, E, RO>, params: P) {
    this.dispatchEvent(
      new CustomEvent(type.method, {
        detail: {
          jsonrpc: '2.0',
          requestId: 0,
          method: type.method,
          params,
        },
      }),
    );
  }
}
