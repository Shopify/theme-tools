import { startServer as startCoreServer } from '@shopify/liquid-language-server-common';

// This is where you do the worker.postMessage stuff?
// Or is this where we accept the worker.postMessage stuff?
// Yeah I think this is where you _accept_ the worker.postMessage stuff
export function startServer() {
  startCoreServer();
}
