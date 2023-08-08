import { vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createConnection } from 'vscode-languageserver/lib/common/server';
import {
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializedNotification,
  InitializeRequest,
  MessageSignature,
  ProtocolConnection,
  WatchDog,
  _Connection,
} from 'vscode-languageserver';

type MockConnectionMethods = {
  /**
   * Trigger all appropriate onNotification handlers on the connection
   */
  triggerNotification: ReturnType<typeof createConnection>['sendNotification'];
  /**
   * Trigger all appropriate onRequest handlers on the connection
   */
  triggerRequest: ReturnType<typeof createConnection>['sendRequest'];

  /**
   * Perform the initialize/initialized lifecycle methods
   */
  setup(): void;

  /**
   * Perform the textDocument/didOpen notification
   */
  openDocument(relativePath: string, contents: string): void;

  /**
   * Perform the textDocument/didChange notification
   */
  changeDocument(relativePath: string, contents: string, version: number): void;

  /**
   * Perform the textDocument/didClose notification
   */
  closeDocument(relativePath: string): void;

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
    sendRequest: vi.fn() as any,
    trace: vi.fn().mockReturnValue(Promise.resolve()),
  } satisfies ProtocolConnection;
}

export function mockConnection(): MockConnection {
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

    setup() {
      triggerRequest(InitializeRequest.method, { capabilities: {} });
      triggerNotification(InitializedNotification.method);
    },

    openDocument(relativePath, text) {
      triggerNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          languageId: 'liquid',
          uri: `browser:///${relativePath}`,
          version: 0,
          text,
        },
      });
    },

    changeDocument(relativePath, text, version) {
      triggerNotification(DidChangeTextDocumentNotification.type, {
        textDocument: {
          uri: `browser:///${relativePath}`,
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
          uri: `browser:///${relativePath}`,
        },
      });
    },
  };

  return Object.assign(connection, mockConnectionMethods) satisfies MockConnection;
}
