import { DocsetEntry } from '@shopify/theme-check-common';
import { Tag, Attribute } from '../../HtmlDocset';

type HtmlEntry = Tag | Attribute;

const HORIZONTAL_SEPARATOR = '\n\n---\n\n';

export function render(entry: DocsetEntry) {
  return [title(entry), docsetEntryBody(entry)].filter(Boolean).join('\n');
}

export function renderHtmlEntry(entry: HtmlEntry) {
  return [title(entry), htmlEntryBody(entry)].join('\n');
}

function title(entry: { name: string }) {
  return `### ${entry.name}`;
}

function docsetEntryBody(entry: DocsetEntry) {
  return [entry.deprecation_reason, entry.summary, entry.description]
    .filter(Boolean)
    .join(HORIZONTAL_SEPARATOR);
}

function htmlEntryBody(entry: HtmlEntry) {
  return [description(entry), references(entry)].filter(Boolean).join(HORIZONTAL_SEPARATOR);
}

function description(entry: HtmlEntry) {
  if (!entry.description || typeof entry.description === 'string') {
    return entry.description;
  }

  return entry.description.value;
}

function references(entry: HtmlEntry) {
  if (!entry.references) return undefined;
  return [`#### Learn more`, entry.references.map((ref) => `- [${ref.name}](${ref.url})`)].join(
    '\n\n',
  );
}
