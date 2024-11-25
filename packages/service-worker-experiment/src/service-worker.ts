const version = 3;
console.log('hello world', version);

const sw: ServiceWorkerGlobalScope = self as any;

sw.addEventListener('install', (e) => {
  console.error('install', version);

  // You only have one service worker running at a time

  // You normally wait for all tabs to close before activating
  // the new version of the service worker.

  // We probably can skip waiting...
  sw.skipWaiting();
});

sw.addEventListener('activate', (e) => {
  console.error('activation', version);
});

sw.addEventListener('message', (e) => {
  switch (e.data.type) {
    case 'refresh': {
      //
      self.postMessage('');
    }
  }
});

async function preview(pathname: string) {
  return fetch(pathname + '?pb=0&_fd=0', {
    method: 'POST',
    headers: {},
  });
}

async function asset(pathname: string) {
  return fetch('http://127.0.0.1:9292' + pathname + '?pb=0&_fd=0', {
    mode: 'no-cors',
    headers: {},
  });
}

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/preview')) {
    console.error('preview', url.pathname);
    event.respondWith(preview(url.pathname.replace('/preview', '')));
  } else if (
    ['/cdn', '/checkout', '/__hot-reload/subscribe'].some((path) => url.pathname.startsWith(path))
  ) {
    event.respondWith(asset(url.pathname));
  }
});
