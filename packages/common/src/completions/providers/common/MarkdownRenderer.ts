import { DocsetEntry } from '@shopify/theme-check-common';

const HORIZONTAL_SEPARATOR = '\n\n---\n\n';

export function render(entry: DocsetEntry) {
  return [title(entry), body(entry)].filter(exists).join('\n');
}

function title(entry: DocsetEntry) {
  return entry.link
    ? `### [${entry.name}](${entry.link})`
    : `### ${entry.name}`;
}

function body(entry: DocsetEntry) {
  return [entry.deprecationReason, entry.summary, entry.description]
    .filter(exists)
    .join(HORIZONTAL_SEPARATOR);
}

function exists(content?: string) {
  return Boolean(content);
}
