import { DocumentSelector } from 'vscode';

/**
 * The document selectors is the list of documents for which vscode needs to send requests/notifications to the language server.
 *
 * We specifically don't want to answer completion requests in package.json files and so on.
 *
 * Nor do we want to handle js,css,scss liquid files.
 */
export const documentSelectors: DocumentSelector = [
  { language: 'liquid', pattern: '**/*.liquid' },
  { language: 'json', pattern: '**/{config,locales,sections,templates}/**/*.json' },
  { language: 'jsonc', pattern: '**/{config,locales,sections,templates}/**/*.json' },
];
