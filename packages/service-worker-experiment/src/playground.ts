function logState(state: any) {
  var liElement = document.createElement('li');
  liElement.textContent = state;
  document.querySelector('#states')!.appendChild(liElement);
}

if ('serviceWorker' in navigator) {
  // Override the default scope of '/' with './', so that the registration applies
  // to the current directory and everything underneath it.
  navigator.serviceWorker
    .register('service-worker.bundle.js', { scope: '/' })
    .then(function (registration) {
      // At this point, registration has taken place.
      // The service worker will not handle requests until this page and any
      // other instances of this page (in other tabs, etc.) have been
      // closed/reloaded.
      document.querySelector('#register')!.textContent = 'succeeded';

      var serviceWorker;
      if (registration.installing) {
        serviceWorker = registration.installing;
        document.querySelector('#kind')!.textContent = 'installing';
      } else if (registration.waiting) {
        serviceWorker = registration.waiting;
        document.querySelector('#kind')!.textContent = 'waiting';
      } else if (registration.active) {
        serviceWorker = registration.active;
        document.querySelector('#kind')!.textContent = 'active';
      }

      if (serviceWorker) {
        logState(serviceWorker.state);
        serviceWorker.addEventListener('statechange', function (e: any) {
          logState(e.target.state);
        });
      }
    })
    .catch(function (error) {
      // Something went wrong during registration. The service-worker.js file
      // might be unavailable or contain a syntax error.
      document.querySelector('#register')!.textContent = 'failed: ' + error;
    });
} else {
  // The current browser doesn't support service workers.
  document.querySelector('#availability')!.textContent = 'are not';
}
