/* eslint-disable lines-between-class-members */
import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  ExitNotification,
  InitializeRequest,
  InitializedNotification,
  Message,
  NotificationHandler,
  NotificationMessage,
  ProtocolNotificationType,
  ProtocolRequestType,
  ProtocolRequestType0,
  RequestHandler,
  RequestMessage,
  ResponseError,
  ResponseMessage,
  ShutdownRequest,
  MessageSignature,
  ProtocolNotificationType0,
  ServerCapabilities,
  ClientCapabilities,
} from 'vscode-languageserver-protocol';

export interface PromiseCompletion {
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

export interface Dependencies {
  clientCapabilities: ClientCapabilities;
  initializationOptions?: any;
  log(...args: any[]): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Useful for mocking/stubbing the client in our tests. aka our "public" API.
export interface AbstractLanguageClient {
  clientCapabilities: ClientCapabilities;
  serverCapabilities: ServerCapabilities | null;
  serverInfo: any;
  onRequest: LanguageClient['onRequest'];
  onNotification: LanguageClient['onNotification'];
  sendRequest: LanguageClient['sendRequest'];
  sendNotification: LanguageClient['sendNotification'];
}

export class LanguageClient extends EventTarget implements AbstractLanguageClient {
  public readonly clientCapabilities: ClientCapabilities;
  public readonly initializationOptions: any;
  public serverCapabilities: ServerCapabilities | null;
  public serverInfo: any;

  private requestId: number;
  private requests: Map<string, PromiseCompletion>;
  private dispose: () => void;
  private disposables: Disposable[];
  private log: Dependencies['log'];

  constructor(
    public readonly worker: Worker,
    dependencies: Dependencies,
  ) {
    super();
    this.requests = new Map();
    this.requestId = 0;
    this.dispose = () => {};
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
    const handler = (ev: MessageEvent<Message>) => this.handleMessage(ev.data);
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
    const response = await this.sendRequest(InitializeRequest.type, {
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
    this.sendNotification(InitializedNotification.type, {});
  }

  /**
   * Lifecycle method to stop the server
   */
  async stop() {
    await Promise.race([this.sendRequest(ShutdownRequest.type), sleep(1000)]);
    this.disposables.forEach((disposable) => disposable.dispose());
    this.disposables = [];
    this.dispose();
    this.sendNotification(ExitNotification.type);
  }

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
  onRequest<P, R, PR, E, RO>(
    type: ProtocolRequestType<P, R, PR, E, RO>,
    handler: RequestHandler<P, R, E>,
  ): Disposable;
  onRequest<P>(type: string | MessageSignature, handler: RequestHandler<P, any, any>): Disposable {
    const method = typeof type === 'string' ? type : type.method;
    const callback = async (event: Event) => {
      const { params, id } = (event as CustomEvent<RequestMessage>).detail;
      const cancellationToken: CancellationToken = new CancellationTokenSource().token;
      try {
        const response = await handler(params as any as P, cancellationToken);
        if (response && typeof response === 'object' && 'code' in response) {
          this.sendResponse(id!, undefined, response as any as ResponseError);
        } else {
          this.sendResponse(id!, response, undefined);
        }
      } catch (error) {
        this.sendResponse(
          id!,
          undefined,
          new ResponseError(1, error instanceof Error ? error.message : (error as string)),
        );
      }
    };

    this.addEventListener(method, callback);
    return this.disposable(() => this.removeEventListener(method, callback));
  }

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
  onNotification<P, RO>(
    type: ProtocolNotificationType<P, RO>,
    handler: NotificationHandler<P>,
  ): Disposable;
  onNotification<P>(type: string | MessageSignature, handler: NotificationHandler<P>): Disposable {
    const method = typeof type === 'string' ? type : type.method;
    const callback = (event: Event) => {
      const { params } = (event as CustomEvent<NotificationMessage>).detail;
      handler(params as any as P);
    };

    this.addEventListener(method, callback);
    return this.disposable(() => this.removeEventListener(method, callback));
  }

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
  public sendRequest<R, PR, E, RO>(type: ProtocolRequestType0<R, PR, E, RO>): Promise<R>;
  public sendRequest<P, R, PR, E, RO>(
    type: ProtocolRequestType<P, R, PR, E, RO>,
    params?: P,
  ): Promise<R>;
  public async sendRequest<R>(type: string | MessageSignature, params?: any): Promise<R> {
    this.requestId += 1;
    const requestId = this.requestId;
    const method = typeof type === 'string' ? type : type.method;
    const request: RequestMessage = {
      jsonrpc: '2.0',
      id: requestId,
      method,
    };
    if (params) request.params = params;

    this.log(`Client->Server ${request.method} request [${request.id}]`, request);
    this.sendMessage(request);

    return new Promise((resolve, reject) => {
      this.requests.set(requestId.toString(), { resolve, reject });
    });
  }

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
  public sendNotification<RO>(type: ProtocolNotificationType0<RO>): void;
  public sendNotification<P, RO>(type: ProtocolNotificationType<P, RO>, params?: P): void;
  public sendNotification(type: string | MessageSignature, params?: any): void {
    const method = typeof type === 'string' ? type : type.method;
    const notification: NotificationMessage = {
      jsonrpc: '2.0',
      method,
    };
    if (params) notification.params = params;
    this.log(`Client->Server ${method} notification`, notification);
    this.sendMessage(notification);
  }

  private sendResponse(id: number | string, result: any, error?: ResponseError) {
    const response: ResponseMessage = { jsonrpc: '2.0', id };
    if (result !== undefined) response.result = result;
    if (error !== undefined) response.error = error.toJson();
    this.log(`Client->Server response [${id}]`, response);
    this.sendMessage(response);
  }

  private sendMessage(message: Message) {
    this.worker.postMessage(message);
  }

  /**
   * Map messages to their correct destition.
   *  - Responses -> resolve or reject the corresponding Request
   *  - Notification -> emit(message.method, message)
   *  - Request -> emit(message.method, message)
   */
  private handleMessage(message: any) {
    if (isResponse(message)) {
      this.log(`Server->Client response [${message.id}]`, message);
      const id = message.id!.toString();
      if ('result' in message) {
        this.requests.get(id)!.resolve(message.result!);
      } else {
        this.requests.get(id)!.reject(message.error);
      }
      this.requests.delete(id);
    } else if (isRequest(message)) {
      this.log(`Server->Client ${message.method} request [${message.id}]`, message);
      this.dispatchEvent(new CustomEvent<RequestMessage>(message.method, { detail: message }));
    } else if (isNotification(message)) {
      this.log(`Server->Client ${message.method} notification`, message);
      this.dispatchEvent(
        new CustomEvent(message.method, {
          detail: message,
        }),
      );
    } else {
      this.log('what?', message);
    }
  }

  private disposable(dispose: () => void) {
    const disp = disposable(dispose);
    this.disposables.push(disp);
    return disp;
  }
}

export function disposable(dispose: () => void): Disposable {
  return { dispose };
}

function isResponse(message: any): message is ResponseMessage {
  return 'id' in message && ('error' in message || 'result' in message);
}

function isRequest(message: any): message is RequestMessage {
  return 'id' in message && 'method' in message;
}

function isNotification(message: any): message is NotificationMessage {
  return !('id' in message) && 'method' in message;
}
