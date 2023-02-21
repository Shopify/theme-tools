import {
  InitializeResult,
  PublishDiagnosticsNotification,
  PublishDiagnosticsParams,
} from 'vscode-languageserver-protocol';
import {
  DidChangeTextDocumentParams,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializeRequest,
  InitializeParams,
  ResponseMessage,
} from 'vscode-languageserver-protocol';
import {} from 'vscode-languageserver-types';
import './styles.css';

const input = document.getElementById('input') as HTMLTextAreaElement;
const output = document.getElementById('output') as HTMLTextAreaElement;

interface PromiseCompletion {
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

function isResponse(message: any): message is ResponseMessage {
  return message.id && ('error' in message || 'result' in message);
}

class SimpleLanguageClient extends EventTarget {
  private requestId: number;
  private requests: Map<string, PromiseCompletion>;
  private dispose: () => void;

  constructor(public readonly worker: Worker) {
    super();
    this.requests = new Map();
    this.requestId = 0;
    this.dispose = () => {};
  }

  /**
   * This is the method you use to react to messages from the server.
   *
   * @example
   * client.on('textDocument/publishDiagnostics', (params: PublishDiagnosticsParams) => {
   *   ...
   * })
   */
  on<T>(method: string, callback: (params: T) => void): void {
    this.addEventListener(method, (event: Event) => {
      callback((event as CustomEvent<T>).detail);
    });
  }

  /**
   * Lifecycle method to start the server
   */
  start() {
    const handler = this.handleMessage.bind(this);
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
      const id = message.id!.toString();
      if ('result' in message) {
        this.requests.get(id)!.resolve(message.result!);
      } else {
        this.requests.get(id)!.reject(message.error);
      }
      this.requests.delete(id);
    } else {
      this.dispatchEvent(new CustomEvent(message.method, message.params));
    }
  }

  async sendRequest<ReturnType>(
    method: string,
    params?: any,
  ): Promise<ReturnType> {
    this.requestId += 1;
    this.sendMessage({
      id: this.requestId,
      method,
      params,
    });

    return new Promise((resolve, reject) => {
      this.requests.set(this.requestId.toString(), { resolve, reject });
    });
  }

  sendNotification(method: string, params?: any): void {
    this.sendMessage({
      method,
      params,
    });
  }

  sendMessage(message: any) {
    message.jsonrpc = '2.0';
    this.worker.postMessage(message);
  }
}

async function main() {
  const languageServer = new Worker(new URL('./worker.js', import.meta.url));
  const client = new SimpleLanguageClient(languageServer);
  client.start();

  let textDocumentVersion = 0;

  // Initialize loop
  const initParams: InitializeParams = {
    capabilities: {},
    processId: 0,
    rootUri: 'browser://',
  };

  const resp: InitializeResult = await client.sendRequest(
    InitializeRequest.method,
    initParams,
  );

  const serverCapabilities = resp.capabilities;
  const serverInfo = resp.serverInfo;

  client.on(
    PublishDiagnosticsNotification.method,
    (params: PublishDiagnosticsParams) => {
      console.log(params);
    },
  );

  client.sendNotification(DidOpenTextDocumentNotification.method, {
    textDocument: {
      uri: 'browser://input',
      languageId: 'liquid',
      version: textDocumentVersion,
      text: input.value,
    },
  });

  input.addEventListener('input', () => {
    textDocumentVersion += 1;
    const didChangeParams: DidChangeTextDocumentParams = {
      textDocument: {
        uri: 'browser://input',
        version: textDocumentVersion,
      },
      contentChanges: [
        {
          text: input.value,
        },
      ],
    };

    client.sendNotification(
      DidChangeTextDocumentNotification.method,
      didChangeParams,
    );
  });
}

main();
