import { DocsetEntry, FilterEntry, ObjectEntry } from '@shopify/theme-check-common';
import { ArrayType, PseudoType, docsetEntryReturnType, isArrayType } from '../TypeSystem';
import { Attribute, Tag, Value } from './HtmlDocset';

const HORIZONTAL_SEPARATOR = '\n\n---\n\n';

type HtmlEntry = Tag | Attribute | Value;

export function render(entry: DocsetEntry, returnType?: PseudoType | ArrayType) {
  return [title(entry, returnType), docsetEntryBody(entry)].filter(Boolean).join('\n');
}

export function renderHtmlEntry(entry: HtmlEntry, parentEntry?: HtmlEntry) {
  return [title(entry, 'untyped'), htmlEntryBody(entry, parentEntry)].join('\n');
}

function title(
  entry: DocsetEntry | ObjectEntry | FilterEntry | HtmlEntry,
  returnType?: PseudoType | ArrayType,
) {
  returnType = returnType ?? docsetEntryReturnType(entry as ObjectEntry, 'untyped');

  if (isArrayType(returnType)) {
    return `### ${entry.name}: \`${returnType.valueType}[]\``;
  } else if (returnType !== 'untyped') {
    return `### ${entry.name}: \`${returnType}\``;
  }

  return `### ${entry.name}`;
}

function sanitize(s: string | undefined) {
  return s
    ?.replace(/(^|\n+)&gt;/g, ' ')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\]\(\//g, '](https://shopify.dev/')
    .trim();
}

function docsetEntryBody(entry: DocsetEntry) {
  return [entry.deprecation_reason, entry.summary, entry.description]
    .map(sanitize)
    .filter(Boolean)
    .join(HORIZONTAL_SEPARATOR);
}

function htmlEntryBody(entry: HtmlEntry, parentEntry?: HtmlEntry) {
  return [description(entry), references(entry), references(parentEntry)]
    .filter(Boolean)
    .join(HORIZONTAL_SEPARATOR);
}

function description(entry: HtmlEntry) {
  if (!entry.description || typeof entry.description === 'string') {
    return entry.description;
  }

  return entry.description.value;
}

function references(entry: HtmlEntry | undefined) {
  if (!entry || !('references' in entry) || !entry.references || entry.references.length === 0) {
    return undefined;
  }

  if (entry.references.length === 1) {
    const [ref] = entry.references;
    return `[${ref.name}](${ref.url})`;
  }

  return [`#### Learn more`, entry.references.map((ref) => `- [${ref.name}](${ref.url})`)].join(
    '\n\n',
  );
}
