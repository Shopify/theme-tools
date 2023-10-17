import { Facet } from '@codemirror/state';

import { AbstractLanguageClient } from '../LanguageClient';

export const clientFacet = Facet.define<AbstractLanguageClient, AbstractLanguageClient>({
  combine: (values) => values[0],
});

export const fileUriFacet = Facet.define<string, string>({
  combine: (values) => values[0],
});
