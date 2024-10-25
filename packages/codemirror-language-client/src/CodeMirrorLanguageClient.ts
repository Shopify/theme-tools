import { Extension } from '@codemirror/state';
import { ClientCapabilities, MarkupKind } from 'vscode-languageserver-protocol';

import { Dependencies, LanguageClient } from './LanguageClient';
import {
  AutocompleteOptions,
  DiagnosticRenderer,
  HoverOptions,
  HoverRenderer,
  InfoRenderer,
  LinterOptions,
  clientFacet,
  diagnosticRendererFacet,
  fileUriFacet,
  infoRendererFacet,
  lspComplete,
  lspDocumentHighlights,
  lspHover,
  lspLinter,
  serverCapabilitiesFacet,
  textDocumentSync,
} from './extensions';
import { hoverRendererFacet } from './extensions/hover';

/**
 * The client capabilities are how we tell the language server what
 * features we support so that they have the opportunity to skip doing
 * things that the client does not support. Everything is false by default,
 * but we migth need to change that and this is where we'll do it.
 */
const clientCapabilities: ClientCapabilities = {
  textDocument: {
    documentHighlight: {
      dynamicRegistration: false,
    },
    completion: {
      // We send the completion context to the server
      contextSupport: true,
      completionItem: {
        snippetSupport: true,
        insertReplaceSupport: true,
        documentationFormat: [MarkupKind.PlainText, MarkupKind.Markdown],
        commitCharactersSupport: false,
      },
    },
  },
};

const defaultLogger = console.log.bind(console);

export { Dependencies };

export interface FeatureFlags {
  shouldComplete: boolean;
  shouldLint: boolean;
  shouldHover: boolean;
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

  /**
   * Say you wanted to change the settings of the `autocomplete` extension,
   * you'd do it with that.
   */
  autocompleteOptions?: AutocompleteOptions;

  /**
   * Say you wanted to change the settings of the `linter` extension,
   * you'd do it with that.
   */
  linterOptions?: LinterOptions;

  /**
   * The diagnosticRenderer is a function that returns a DOM node that
   * contains the content of a diagnostic. It overrides the default
   * rendering logic for diagnostics.
   */
  diagnosticRenderer?: DiagnosticRenderer;

  /**
   * The hoverRenderer is a function that returns a DOM node that contains the documentation
   * for the item under the cursor. The documentation is provided by the Language Server.
   */
  hoverRenderer?: HoverRenderer;

  /**
   * Say you wanted to change the settings of the `hoverTooltip` extension,
   * you'd do it with that.
   */
  hoverOptions?: HoverOptions;
}

// There is one LanguageClient
// There is one LanguageServer
// There are many CodeMirror instances
export class CodeMirrorLanguageClient {
  readonly client: LanguageClient;
  private readonly infoRenderer: InfoRenderer | undefined;
  private readonly autocompleteExtension: Extension;
  private readonly diagnosticRenderer: DiagnosticRenderer | undefined;
  private readonly linterExtension: Extension;
  private readonly hoverRenderer: HoverRenderer | undefined;
  private readonly hoverExtension: Extension;
  private readonly documentHighlightsExtension: Extension;

  constructor(
    private readonly worker: Worker,
    { log = defaultLogger }: ClientDependencies = {},
    {
      infoRenderer,
      autocompleteOptions,
      diagnosticRenderer,
      linterOptions,
      hoverRenderer,
      hoverOptions,
    }: CodeMirrorDependencies = {},
  ) {
    this.client = new LanguageClient(worker, {
      clientCapabilities,
      log,
    });
    this.worker = worker;
    this.infoRenderer = infoRenderer;
    this.autocompleteExtension = lspComplete(autocompleteOptions);

    this.diagnosticRenderer = diagnosticRenderer;
    this.linterExtension = lspLinter(linterOptions);

    this.hoverRenderer = hoverRenderer;
    this.hoverExtension = lspHover(hoverOptions);

    this.documentHighlightsExtension = lspDocumentHighlights();
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
    { shouldLint, shouldComplete, shouldHover }: FeatureFlags = {
      shouldLint: true,
      shouldComplete: true,
      shouldHover: true,
    },
  ): Extension[] {
    return [
      clientFacet.of(this.client),
      serverCapabilitiesFacet.of(this.client.serverCapabilities),
      fileUriFacet.of(fileUri),
      textDocumentSync,
      infoRendererFacet.of(this.infoRenderer),
      diagnosticRendererFacet.of(this.diagnosticRenderer),
      hoverRendererFacet.of(this.hoverRenderer),
      this.documentHighlightsExtension,
    ]
      .concat(shouldLint ? this.linterExtension : [])
      .concat(shouldComplete ? this.autocompleteExtension : [])
      .concat(shouldHover ? this.hoverExtension : []);
  }
}
