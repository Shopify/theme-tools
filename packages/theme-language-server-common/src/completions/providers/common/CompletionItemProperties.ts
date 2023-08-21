import { CompletionItem, CompletionItemTag, MarkupContent } from 'vscode-languageserver';
import { render } from './MarkdownRenderer';
import { DocsetEntry } from '@shopify/theme-check-common';

// ASCII tokens that make a string appear lower in the list.
//
// It's setup so that we can show array filters before "global" filters,
// and similarly array deprecated filters before "global" deprecated
// filters.
enum SortTokens {
  normal = '',
  deprioritized = '{',
  deprecated = '|',
  deprecatedAndDeprioritized = '}',
}

export function createCompletionItem(
  entry: DocsetEntry & { deprioritized?: boolean },
  extraProperties: Partial<CompletionItem> = {},
): CompletionItem {
  // prettier-ignore
  const sortToken = entry.deprecated
    ? entry.deprioritized
      ? SortTokens.deprecatedAndDeprioritized
      : SortTokens.deprecated
    : entry.deprioritized
      ? SortTokens.deprioritized
      : SortTokens.normal;
  return {
    label: entry.name,
    sortText: `${sortToken}${entry.name}`,
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

function deprecatedProperties(entry: DocsetEntry & { deprioritized?: boolean }) {
  if (!entry.deprecated) return {};

  const tags: CompletionItemTag[] = [CompletionItemTag.Deprecated];

  return {
    tags,
  };
}
