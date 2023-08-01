import {
  CompletionItem,
  CompletionItemTag,
  MarkupContent,
} from 'vscode-languageserver';
import { render } from './MarkdownRenderer';
import { DocsetEntry } from '@shopify/theme-check-common';

export function createCompletionItem(
  entry: DocsetEntry,
  extraProperties: Partial<CompletionItem> = {},
): CompletionItem {
  return {
    label: entry.name,
    sortText: entry.name,
    ...documentationProperties(entry),
    ...deprecatedProperties(entry),
    ...extraProperties,
  };
}

function documentationProperties(entry: DocsetEntry): {
  documentation: MarkupContent;
} {
  const value = render(entry);

  return {
    documentation: {
      kind: 'markdown',
      value,
    },
  };
}

function deprecatedProperties(entry: DocsetEntry) {
  if (!entry.deprecated) return {};

  const tags: CompletionItemTag[] = [CompletionItemTag.Deprecated];
  const sortText = `~${entry.name}`;

  return {
    tags,
    sortText,
  };
}
