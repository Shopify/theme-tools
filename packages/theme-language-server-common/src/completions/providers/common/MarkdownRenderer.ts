import { DocsetEntry, FilterEntry, ObjectEntry } from '@shopify/theme-check-common';
import { Tag, Attribute } from '../../HtmlDocset';
import { ArrayType, docsetEntryReturnType, isArrayType, PseudoType } from '../../../TypeSystem';

const HORIZONTAL_SEPARATOR = '\n\n---\n\n';

type HtmlEntry = Tag | Attribute;

export function render(entry: DocsetEntry, returnType?: PseudoType | ArrayType) {
  return [title(entry, returnType), docsetEntryBody(entry)].filter(exists).join('\n');
}

export function renderHtmlEntry(entry: HtmlEntry) {
  return [title(entry, 'untyped'), htmlEntryBody(entry)].join('\n');
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
  if (!entry.references || entry.references.length === 0) return undefined;
  return [`#### Learn more`, entry.references.map((ref) => `- [${ref.name}](${ref.url})`)].join(
    '\n\n',
  );
}
