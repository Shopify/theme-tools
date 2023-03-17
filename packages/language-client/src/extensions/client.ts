import { Facet } from '@codemirror/state';

import { LanguageClient } from '../LanguageClient';

export const clientFacet = Facet.define<LanguageClient, LanguageClient>({
  combine: (values) => values[0],
});

export const fileUriFacet = Facet.define<string, string>({
  combine: (values) => values[0],
});
