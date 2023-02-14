import './styles.css';

const input = document.getElementById('input');
const output = document.getElementById('output');
const worker = new Worker(new URL('./worker.js', import.meta.url));
const requests = new Map();
let textDocumentVersion = 0;
let id = 0;

function sendMessage(message) {
  output.innerHTML += '[CLIENT] Sending Message:\n';
  output.innerHTML += JSON.stringify(message, null, 2);
  output.innerHTML += `\n`;
  message.jsonrpc = '2.0';
  worker.postMessage(message);
}

// This is a promise that resolves when we receive a message event with the
// corresponding ID.
function sendRequest(method, params) {
  id += 1;
  sendMessage({
    method,
    params,
    id,
  });
  return new Promise((resolve, reject) => {
    requests.set(id, { resolve, reject });
  });
}

function sendNotification(method, params) {
  sendMessage({
    method,
    params,
  });
}

function isRequest(message) {
  return message.id && message.method;
}

function isResponse(message) {
  return message.id && (message.result || message.error);
}

function isNotification(message) {
  return !message.id && message.method;
}

worker.addEventListener('message', ({ data: message }) => {
  output.innerHTML += '[CLIENT] Receiving Message:\n';
  output.innerHTML += JSON.stringify(message, null, 2);
  output.innerHTML += `\n`;
  if (isResponse(message)) {
    requests.get(message.id).resolve(message.result);
    requests.delete(message.id);
  }
});

// Initialize loop
sendRequest('initialize', {
  capabilities: {},
}).then(() => {
  sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: 'browser://input',
      languageId: 'liquid',
      version: textDocumentVersion,
      text: input.value,
    },
  });
});

input.addEventListener('input', () => {
  textDocumentVersion += 1;
  sendNotification('textDocument/didChange', {
    textDocument: {
      uri: 'browser://input',
      languageId: 'liquid',
      version: textDocumentVersion,
      text: input.value,
    },
  });
});
