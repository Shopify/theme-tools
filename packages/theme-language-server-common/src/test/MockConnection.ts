import { vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createConnection } from 'vscode-languageserver/lib/common/server';
import {
  ClientCapabilities,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  DidSaveTextDocumentNotification,
  InitializedNotification,
  InitializeParams,
  InitializeRequest,
  MessageSignature,
  ProtocolConnection,
  WatchDog,
} from 'vscode-languageserver';
import { path } from '@shopify/theme-check-common';

type MockConnectionMethods = {
  /** Trigger all appropriate onNotification handlers on the connection */
  triggerNotification: ReturnType<typeof createConnection>['sendNotification'];

  /** Trigger all appropriate onRequest handlers on the connection */
  triggerRequest: ReturnType<typeof createConnection>['sendRequest'];

  /** Perform the initialize/initialized lifecycle methods */
  setup(capabilities?: ClientCapabilities, initializationOptions?: any): void;

  /** Perform the textDocument/didOpen notification */
  openDocument(relativePath: string, contents: string): void;

  /** Perform the textDocument/didChange notification */
  changeDocument(relativePath: string, contents: string, version: number): void;

  /** Perform the textDocument/didClose notification */
  closeDocument(relativePath: string): void;

  /** Perform the textDocument/didSave notification */
  saveDocument(relativePath: string): void;

  spies: ReturnType<typeof protocolConnection>;
};

/**
 * A mock connection behaves like a real connection, except we can trigger
 * messages manually via the extra MockConnectionMethods.
 */
export type MockConnection = ReturnType<typeof createConnection> & MockConnectionMethods;

function protocolConnection(requests: EventEmitter, notifications: EventEmitter) {
  return {
    dispose: vi.fn(),
    end: vi.fn(),
    hasPendingResponse: vi.fn(),
    listen: vi.fn(),
    onClose: vi.fn(),
    onDispose: vi.fn(),
    onError: vi.fn(),
    onProgress: vi.fn(),
    onNotification: vi.fn().mockImplementation((type: MessageSignature, handler) => {
      notifications.addListener(type.method, handler);
    }),
    onRequest: vi.fn().mockImplementation((type: MessageSignature, handler) => {
      requests.addListener(type.method, handler);
    }),
    onUnhandledNotification: vi.fn(),
    sendNotification: vi.fn().mockReturnValue(Promise.resolve()),
    sendProgress: vi.fn(),
    sendRequest: vi.fn(),
    trace: vi.fn().mockReturnValue(Promise.resolve()),
  } satisfies ProtocolConnection;
}

export function mockConnection(rootUri: string): MockConnection {
  const watchDog: WatchDog = {
    exit: vi.fn(),
    initialize: vi.fn(),
    shutdownReceived: false,
  };

  const requests = new EventEmitter();
  const notifications = new EventEmitter();
  const spies = protocolConnection(requests, notifications);

  // Create a real "connection" with the fake communication channel
  const connection = createConnection(() => spies, watchDog);

  // Create a mock way to trigger notification in our tests
  const triggerNotification: MockConnection['sendNotification'] = async (...args: any[]) => {
    const [type, params] = args;
    const method = typeof type === 'string' ? type : type.method;
    notifications.emit(method, params);
  };

  // Create a mock way to trigger requests in our tests
  const triggerRequest: MockConnection['triggerRequest'] = async (...args: any[]) => {
    const [type, params] = args;
    const method = typeof type === 'string' ? type : type.method;
    requests.emit(method, params);
  };

  const mockConnectionMethods: MockConnectionMethods = {
    triggerNotification,
    triggerRequest,
    spies,

    setup(capabilities: ClientCapabilities = {}, initializationOptions = {}) {
      triggerRequest(InitializeRequest.method, {
        capabilities,
        initializationOptions,
      } as InitializeParams);
      triggerNotification(InitializedNotification.method);
    },

    openDocument(relativePath, text) {
      triggerNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          languageId: 'liquid',
          uri: path.join(rootUri, relativePath),
          version: 0,
          text,
        },
      });
    },

    changeDocument(relativePath, text, version) {
      triggerNotification(DidChangeTextDocumentNotification.type, {
        textDocument: {
          uri: path.join(rootUri, relativePath),
          version,
        },
        contentChanges: [
          {
            text,
          },
        ],
      });
    },

    closeDocument(relativePath) {
      triggerNotification(DidCloseTextDocumentNotification.type, {
        textDocument: {
          uri: path.join(rootUri, relativePath),
        },
      });
    },

    saveDocument(relativePath) {
      triggerNotification(DidSaveTextDocumentNotification.type, {
        textDocument: {
          uri: path.join(rootUri, relativePath),
        },
      });
    },
  };

  return Object.assign(connection, mockConnectionMethods) satisfies MockConnection;
}
