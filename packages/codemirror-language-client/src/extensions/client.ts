import { Facet } from '@codemirror/state';

import { ServerCapabilities } from 'vscode-languageserver-protocol';
import { AbstractLanguageClient } from '../LanguageClient';

export const clientFacet = Facet.define<AbstractLanguageClient, AbstractLanguageClient>({
  combine: (values) => values[0],
  static: true,
});

export const fileUriFacet = Facet.define<string, string>({
  combine: (values) => values[0],
});

export const serverCapabilitiesFacet = Facet.define<ServerCapabilities | null, ServerCapabilities>({
  combine: (values) => values[0] ?? {},
});
