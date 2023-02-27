import {
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializedNotification,
  InitializeParams,
  InitializeRequest,
  PublishDiagnosticsNotification,
} from 'vscode-languageserver-protocol';
import * as is from './is';
import { SimpleLanguageClient } from './simple-language-client';
import './styles.css';

const inputTextArea = document.getElementById('input') as HTMLTextAreaElement;
const output = document.getElementById('output') as HTMLTextAreaElement;

function log(message: any, prefix = '') {
  output.innerHTML += '\n';
  output.innerHTML += `${prefix}\n`;
  output.innerHTML += JSON.stringify(message, null, 2);
  console.log(message);
}

async function main() {
  // We initialize the language server in a web worker.
  const languageServer = new Worker(new URL('./worker.js', import.meta.url));

  // We initialize a language client on the main thread that will
  // communicate with the language server
  const client = new SimpleLanguageClient(languageServer, { log });

  // We setup message handlers.
  // Here's one that listens to `textDocument/publishDiagnostics`
  // notifications and logs them to the console.
  client.onNotification(PublishDiagnosticsNotification.type, (params) => {
    // Note that `params` has an inferred type here :D
    console.log('received diagnostics!', params.diagnostics);
  });

  // We start the client.
  client.start();

  // State initializer (don't worry about that right now)
  let textDocumentVersion = 0;

  // You can use the types directly by importing them from the lib, but you
  // can also dump it directly in the method call and have typescript
  // complain about missing args. Your choice :D
  //
  // Here we go with the imported type approach
  const initParams: InitializeParams = {
    capabilities: {},
    processId: 0,
    rootUri: 'browser://',
  };

  // Here we start the lifecycle by sending an "initialize" request.
  // `resp` is inferred to be ResponseError<InitializeError> | InitializeResult
  const resp = await client.sendRequest(InitializeRequest.type, initParams);
  console.log(resp);

  if (is.error(resp)) {
    return; // Uh oh!; We should do something smart here...
  }

  // Now we know resp can't be ResponseError<InitializeError> because of
  // the previous if + return. We have inferred the types of resp, and thus
  // of resp.capabilities and resp.serverInfo as well!
  const serverCapabilities = resp.capabilities;
  const serverInfo = resp.serverInfo;

  console.log('Received initialize response!', resp);
  console.log('Received capabilities', serverCapabilities);
  console.log('Received serverInfo', serverInfo);

  // Because we're good LSP citizens, it's now our job to tell the server
  // we're ready to roll! Turns out the expected params is an empty object.
  // Note that we didn't need to type it.
  client.sendNotification(InitializedNotification.type, {});

  // Tell the server that we have opened a file and that its content is the
  // contents of the <textarea id="input"> element
  client.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: {
      uri: 'browser://input',
      languageId: 'liquid',
      version: textDocumentVersion,
      text: inputTextArea.value,
    },
  });

  // Setup an event handler on the textarea that looks for content changes.
  // When it changes, send a `textDocument/didChange` notification to the
  // language server.
  inputTextArea.addEventListener('input', () => {
    textDocumentVersion += 1;

    // Note how we didn't have to type the params. The types are inferred
    // and TS will complain if we don't fit the API.
    client.sendNotification(DidChangeTextDocumentNotification.type, {
      textDocument: {
        uri: 'browser://input',
        version: textDocumentVersion,
      },
      contentChanges: [
        {
          text: inputTextArea.value,
        },
      ],
    });
  });
}

main();
