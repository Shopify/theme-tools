import {
  memoize,
  memo,
  recursiveReadDirectory as findAllFiles,
  path,
} from '@shopify/theme-check-common';
import { toSourceCode } from '../toSourceCode';
import { AugmentedDependencies, IDependencies } from '../types';
import { identity } from '../utils';

export function augmentDependencies(rootUri: string, ideps: IDependencies): AugmentedDependencies {
  return {
    fs: ideps.fs,
    getBlockSchema: memoize(ideps.getBlockSchema, identity),
    getSectionSchema: memoize(ideps.getSectionSchema, identity),

    // parse at most once
    getSourceCode: memoize(
      ideps.getSourceCode ??
        async function defaultGetSourceCode(uri) {
          const contents = await ideps.fs.readFile(uri);
          return toSourceCode(uri, contents);
        },
      identity,
    ),

    getWebComponentDefinitionReference: ideps.getWebComponentDefinitionReference,
    getThemeBlockNames: memo(() =>
      findAllFiles(ideps.fs, path.join(rootUri, 'blocks'), ([uri]) => uri.endsWith('.liquid')).then(
        (uris) => uris.map((uri) => path.basename(uri, '.liquid')),
      ),
    ),
  };
}
