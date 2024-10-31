import { path } from '@shopify/theme-check-common';

export const snippetName = (uri: string) => path.basename(uri, '.liquid');
export const isSnippet = (uri: string) => /\bsnippets(\\|\/)[^\\\/]*\.liquid/.test(uri);

// asset urls have their `.liquid`` removed (if present) and require the other extension */
export const assetName = (uri: string) => path.basename(uri, '.liquid');
export const isAsset = (uri: string) => /\bassets(\\|\/)[^\\\/]/.test(uri);
