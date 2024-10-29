import { path } from '@shopify/theme-check-common';

export const snippetName = (uri: string) => path.basename(uri, '.liquid');
export const isSnippet = (uri: string) => /\bsnippets(\\|\/)[^\\\/]*\.liquid/.test(uri);
