import { Extension } from '@codemirror/state';
import { ClientCapabilities } from 'vscode-languageserver-protocol';

import { Dependencies, LanguageClient } from './LanguageClient';
import {
  clientFacet,
  fileUriFacet,
  textDocumentSync,
  lspLinter,
  liquidHTMLCompletionExtension,
  InfoRenderer,
  infoRendererFacet,
} from './extensions';

/**
 * The client capabilities are how we tell the language server what
 * features we support so that they have the opportunity to skip doing
 * things that the client does not support. Everything is false by default,
 * but we migth need to change that and this is where we'll do it.
 */
const clientCapabilities: ClientCapabilities = {
  textDocument: {
    completion: {
      completionItem: {},
    },
  },
};
const defaultLogger = console.log.bind(console);

export { Dependencies };

export interface FeatureFlags {
  shouldComplete: boolean;
  shouldLint: boolean;
}

export type ClientDependencies = Partial<Dependencies>;

export interface CodeMirrorDependencies {
  /**
   * The infoRenderer is a function that returns a DOM node that contains the documentation
   * for a completion item. Presumably does markdown conversions to DOM nodes.
   *
   * A function that takes a completion object and returns a DOM node.
   */
  infoRenderer?: InfoRenderer;
}

// There is one LanguageClient
// There is one LanguageServer
// There are many CodeMirror instances
export class CodeMirrorLanguageClient {
  private readonly client: LanguageClient;
  private readonly infoRenderer: InfoRenderer | undefined;

  constructor(
    private readonly worker: Worker,
    { log = defaultLogger }: ClientDependencies = {},
    { infoRenderer }: CodeMirrorDependencies = {},
  ) {
    this.client = new LanguageClient(worker, {
      clientCapabilities,
      log,
    });
    this.worker = worker;
    this.infoRenderer = infoRenderer;
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

  public extension(
    fileUri: string,
    { shouldLint, shouldComplete }: FeatureFlags = { shouldLint: true, shouldComplete: true },
  ): Extension[] {
    return [
      clientFacet.of(this.client),
      fileUriFacet.of(fileUri),
      textDocumentSync,
      infoRendererFacet.of(this.infoRenderer),
    ]
      .concat(shouldLint ? lspLinter : [])
      .concat(shouldComplete ? liquidHTMLCompletionExtension : []);
  }
}
