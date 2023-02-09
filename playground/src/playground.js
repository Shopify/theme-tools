const worker = new Worker(new URL('./worker.js', import.meta.url));

console.log('[MAIN] hello worker');

worker.postMessage({
  jsonrpc: '2.0',
  method: 'initialize',
  params: {
    capabilities: {},
  },
  id: 0,
});

worker.addEventListener('message', ({ data: message }) => {
  console.log('[MAIN] message!');
  console.log(`[MAIN] Received ${typeof message}:`, message);
});
