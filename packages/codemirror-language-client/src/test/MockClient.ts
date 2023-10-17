import { vi } from 'vitest';
import {
  ProtocolRequestType,
  ProtocolNotificationType,
  CancellationTokenSource,
  CancellationToken,
} from 'vscode-languageserver-protocol';
import {
  PromiseCompletion,
  AbstractLanguageClient,
  disposable,
} from '../LanguageClient';

export class MockClient extends EventTarget implements AbstractLanguageClient {
  clientCapabilities: AbstractLanguageClient['clientCapabilities'];
  serverCapabilities: AbstractLanguageClient['serverCapabilities'];
  serverInfo: AbstractLanguageClient['serverInfo'];

  // I'm too lazy to copy the types for this stuff.
  onNotification: AbstractLanguageClient['onNotification'];
  onRequest: AbstractLanguageClient['onRequest'];
  sendNotification: AbstractLanguageClient['sendNotification'];
  sendRequest: AbstractLanguageClient['sendRequest'];

  private pendingRequest: Promise<any> | null;
  private promiseCompletion: PromiseCompletion | null;

  constructor(
    clientCapabilities = {},
    serverCapabilities = null,
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
      const cancellationToken: CancellationToken = new CancellationTokenSource()
        .token;
      const callback = (e: any) => handler(e.detail.params, cancellationToken);
      this.addEventListener(type.method, callback);
      return disposable(() => this.removeEventListener(type.method, callback));
    };

    this.sendRequest = vi.fn(async (_type, _params) => {
      this.pendingRequest = new Promise((resolve, reject) => {
        this.promiseCompletion = { resolve, reject };
      });
      await this.pendingRequest;
    }) as any;

    this.sendNotification = vi.fn((_type, _params) => {}) as any;
  }

  resolveRequest(value: any) {
    this.promiseCompletion!.resolve(value);
  }

  rejectRequest(error: any) {
    this.promiseCompletion!.reject(error);
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

  triggerRequest<P, R, PR, E, RO>(
    type: ProtocolRequestType<P, R, PR, E, RO>,
    params: P,
  ) {
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
