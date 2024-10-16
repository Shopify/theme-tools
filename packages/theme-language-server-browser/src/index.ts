import {
  Dependencies,
  startServer as startCoreServer,
} from '@shopify/theme-language-server-common';
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser';

export * from '@shopify/theme-language-server-common';

export function getConnection(worker: Worker) {
  const reader = new BrowserMessageReader(worker);
  const writer = new BrowserMessageWriter(worker);
  return createConnection(reader, writer);
}
// This is where you do the worker.postMessage stuff?
// Or is this where we accept the worker.postMessage stuff?
// Yeah I think this is where you _accept_ the worker.postMessage stuff
export function startServer(
  worker: Worker,
  dependencies: Dependencies,
  connection = getConnection(worker),
) {
  console.info('staging server', worker, dependencies, connection);
  startCoreServer(connection, dependencies);
}
