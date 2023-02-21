import { startServer as startCoreServer } from '@shopify/liquid-language-server-common';
import {
  createConnection,
  Message,
  MessageReader,
  MessageWriter,
  Disposable,
} from 'vscode-languageserver/browser';

const disposable = (dispose: () => void): Disposable => ({ dispose });

// This is where you do the worker.postMessage stuff?
// Or is this where we accept the worker.postMessage stuff?
// Yeah I think this is where you _accept_ the worker.postMessage stuff
export function startServer(worker: Worker) {
  // This is just ugly glue code that basically pipes the messages from the
  // worker connection to the library. They have a very specific interface
  // we need to map to, so that's what we're doing here.
  const reader: MessageReader = {
    onError(_listener) {
      return disposable(() => {});
    },
    onClose(_listener) {
      return disposable(() => {});
    },
    onPartialMessage(_listener) {
      return disposable(() => {});
    },
    dispose() {},
    listen(callback) {
      const onMessage = (message: MessageEvent<any>) => callback(message.data);
      worker.addEventListener('message', onMessage);
      return disposable(() =>
        worker.removeEventListener('message', onMessage),
      );
    },
  };

  // Glue code between our code and the vscode liquid language server
  // It exists to map our messages to postMessage.
  const writer: MessageWriter = {
    onError(_listener) {
      return disposable(() => {});
    },
    onClose(_listener) {
      return disposable(() => {});
    },
    dispose() {},
    end() {},
    async write(msg: Message) {
      worker.postMessage(msg);
    },
  };

  const connection = createConnection(reader, writer);
  startCoreServer(connection, {
    log: (message: string) => console.log(message),
  });
}
