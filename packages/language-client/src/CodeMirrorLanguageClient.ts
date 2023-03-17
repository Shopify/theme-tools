import { Extension } from '@codemirror/state';
import { ClientCapabilities } from 'vscode-languageserver-protocol';

import { LanguageClient } from './LanguageClient';
import {
  clientFacet,
  fileUriFacet,
  textDocumentSync,
  lspLinter,
} from './extensions';

/**
 * The client capabilities are how we tell the language server what
 * features we support so that they have the opportunity to skip doing
 * things that the client does not support. Everything is false by default,
 * but we migth need to change that and this is where we'll do it.
 */
const clientCapabilities: ClientCapabilities = {};

// There is one LanguageClient
// There is one LanguageServer
// There are many CodeMirror instances
export class CodeMirrorLanguageClient {
  private readonly client: LanguageClient;

  constructor(private readonly worker: Worker) {
    this.client = new LanguageClient(worker, {
      // eslint-disable-next-line no-console
      log: console.log.bind(console),
      clientCapabilities,
    });
    this.worker = worker;
  }

  public async start() {
    await this.client.start();
  }

  public async stop() {
    try {
      await this.client.stop();
    } finally {
      this.worker.terminate();
    }
  }

  public extension(fileUri: string): Extension[] {
    return [
      clientFacet.of(this.client),
      fileUriFacet.of(fileUri),
      textDocumentSync,
      lspLinter,
    ];
  }
}
