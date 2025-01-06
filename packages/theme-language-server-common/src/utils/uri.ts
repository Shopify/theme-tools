import { path } from '@shopify/theme-check-common';

export const snippetName = (uri: string) => path.basename(uri, '.liquid');
export const isSnippet = (uri: string) => /\bsnippets(\\|\/)[^\\\/]*\.liquid/.test(uri);

// asset urls have their `.liquid`` removed (if present) and require the other extension */
export const assetName = (uri: string) => path.basename(uri, '.liquid');
export const isAsset = (uri: string) => /\bassets(\\|\/)[^\\\/]/.test(uri);

export const blockName = (uri: string) => path.basename(uri, '.liquid');
export const isBlock = (uri: string) => /\bblocks(\\|\/)[^\\\/]/.test(uri);

export const sectionName = (uri: string) => path.basename(uri, '.liquid');
export const isSection = (uri: string) =>
  /\bsections(\\|\/)[^\\\/]/.test(uri) && /.liquid$/.test(uri);

export const sectionGroupName = (uri: string) => path.basename(uri, '.json');
export const isSectionGroup = (uri: string) =>
  /\bsections(\\|\/)[^\\\/]/.test(uri) && /.json$/.test(uri);

export const templateName = (uri: string) => path.basename(uri, '.json');
export const isTemplate = (uri: string) => /\btemplates(\\|\/)[^\\\/]/.test(uri);
