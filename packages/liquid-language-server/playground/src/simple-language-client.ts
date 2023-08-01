import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  NotificationMessage,
  ProtocolRequestType,
  RequestHandler,
  RequestMessage,
  ResponseMessage,
  ResponseError,
  ProtocolNotificationType,
  NotificationHandler,
  HandlerResult,
  Message,
} from 'vscode-languageserver-protocol';

interface PromiseCompletion {
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

interface Dependencies {
  log(message: any, prefix: string): void;
}

export class SimpleLanguageClient extends EventTarget {
  private requestId: number;
  private requests: Map<string, PromiseCompletion>;
  private dispose: () => void;
  private log: Dependencies['log'];

  constructor(public readonly worker: Worker, dependencies: Dependencies) {
    super();
    this.requests = new Map();
    this.requestId = 0;
    this.dispose = () => {};
    this.log = dependencies.log;
  }

  /**
   * Server->Client request handler. For when you want to handle requests
   * sent from the server.
   *
   * @example
   * client.onRequest(RegistrationRequest.type, (params, cancellationToken) => {
   *    // `params` and `cancellationToken` are typed inferred
   *    return result as RegisterCapabilityResponse
   *  }
   * )
   */
  onRequest<P, R, PR, E, RO>(
    type: ProtocolRequestType<P, R, PR, E, RO>,
    handler: RequestHandler<P, R, E>,
  ): Disposable {
    const callback = async (event: Event) => {
      const { params, id } = (event as CustomEvent<RequestMessage>).detail;
      const cancellationToken: CancellationToken = new CancellationTokenSource()
        .token;
      const response = await Promise.resolve(
        handler(params as P, cancellationToken),
      );
      if (response && typeof response === 'object' && 'code' in response) {
        this.sendResponse(id!, undefined, response as ResponseError);
      } else {
        this.sendResponse(id!, response, undefined);
      }
    };

    this.addEventListener(type.method, callback);
    return {
      dispose: () => {
        this.removeEventListener(type.method, callback);
      },
    };
  }

  /**
   * Server->Client notification handler. For when you want to handle
   * notifications from the server.
   *
   * @example
   * client.onNotification(PublishDiagnosticsNotification.type, (params) => {
   *   // `params` is typed inferred
   *   // Transform and pipe them to CodeMirror
   * });
   */
  onNotification<P, RO>(
    type: ProtocolNotificationType<P, RO>,
    handler: NotificationHandler<P>,
  ): Disposable {
    const callback = (event: Event) => {
      const { params } = (event as CustomEvent<NotificationMessage>).detail;
      handler(params as P);
    };

    this.addEventListener(type.method, callback);
    return {
      dispose: () => {
        this.removeEventListener(type.method, callback);
      },
    };
  }

  /**
   * Lifecycle method to start the server
   */
  start() {
    const handler = (ev: MessageEvent<Message>) => this.handleMessage(ev.data);
    this.worker.addEventListener('message', handler);
    this.dispose = () => {
      this.worker.removeEventListener('message', handler);
    };
  }

  /**
   * Lifecycle method to stop the server. Incomplete.
   */
  stop() {
    this.dispose();
  }

  /**
   * Map messages to their correct destition.
   *  - Responses -> resolve or reject the corresponding Request
   *  - Notification -> emit(message.method, message.params)
   *  - Request -> emit(message.method, message.params)
   */
  private handleMessage(message: any) {
    if (isResponse(message)) {
      this.log(message, `Server->Client response [${message.id}]`);
      const id = message.id!.toString();
      if ('result' in message) {
        this.requests.get(id)!.resolve(message.result!);
      } else {
        this.requests.get(id)!.reject(message.error);
      }
      this.requests.delete(id);
    } else if (isRequest(message)) {
      this.log(message, `Server->Client ${message.method} request [${message.id}]`);
      this.dispatchEvent(
        new CustomEvent<RequestMessage>(message.method, { detail: message }),
      );
    } else if (isNotification(message)) {
      this.log(message, `Server->Client ${message.method} notification`);
      this.dispatchEvent(
        new CustomEvent<NotificationMessage>(message.method, {
          detail: message,
        }),
      );
    } else {
      console.error('what?', message);
    }
  }

  async sendRequest<P, R, PR, E, RO>(
    type: ProtocolRequestType<P, R, PR, E, RO>,
    params?: P,
  ): Promise<HandlerResult<R, E>> {
    this.requestId += 1;
    const request: RequestMessage = {
      jsonrpc: '2.0',
      id: this.requestId,
      method: type.method,
    }
    if (params) request.params = params;

    this.log(request, `Client->Server ${request.method} request [${request.id}]`);
    this.sendMessage(request);

    return new Promise((resolve, reject) => {
      this.requests.set(this.requestId.toString(), { resolve, reject });
    });
  }

  sendNotification<P, RO>(
    type: ProtocolNotificationType<P, RO>,
    params?: P,
  ): void {
    const response: NotificationMessage = {
      jsonrpc: '2.0',
      method: type.method,
    };
    if (params) response.params = params;
    this.log(response, `Client->Server ${type.method} notification`);
    this.sendMessage(response);
  }

  private sendResponse(
    id: number | string,
    result: any,
    error?: ResponseError,
  ) {
    const response: ResponseMessage = { jsonrpc: '2.0', id };
    if (result !== undefined) response.result = result;
    if (error !== undefined) response.error = error;
    this.log(response, `Client->Server response [${id}]`);
    this.sendMessage(response);
  }

  private sendMessage(message: Message) {
    this.worker.postMessage(message);
  }
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
