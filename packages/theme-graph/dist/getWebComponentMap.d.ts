import { Dependencies, Void, WebComponentMap } from './types';
/**
 * Find all the web component definitions from the JavaScript files in the
 * assets directory.
 *
 * From those, we'll be able to map `<custom-element-name>` to the definition in
 * the corresponding asset file.
 */
export declare function getWebComponentMap(rootUri: string, { fs, getSourceCode }: Pick<Dependencies, 'fs' | 'getSourceCode'>): Promise<WebComponentMap>;
export declare function findWebComponentReferences(uri: string, assetRoot: string, getSourceCode: Dependencies['getSourceCode'], result: WebComponentMap): Promise<Void>;
