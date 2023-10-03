import { DocsetEntry, FilterEntry, ObjectEntry } from '@shopify/theme-check-common';
import { ArrayType, PseudoType, docsetEntryReturnType, isArrayType } from '../TypeSystem';
import { Attribute, Tag, Value } from './HtmlDocset';

const HORIZONTAL_SEPARATOR = '\n\n---\n\n';

type HtmlEntry = Tag | Attribute | Value;
export type DocsetEntryType = 'filter' | 'tag' | 'object';

export function render(
  entry: DocsetEntry,
  returnType?: PseudoType | ArrayType,
  docsetEntryType?: DocsetEntryType,
) {
  return [title(entry, returnType), docsetEntryBody(entry, returnType, docsetEntryType)]
    .filter(Boolean)
    .join('\n');
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

function docsetEntryBody(
  entry: DocsetEntry,
  returnType?: PseudoType | ArrayType,
  docsetEntryType?: DocsetEntryType,
) {
  return [
    entry.deprecation_reason,
    entry.summary,
    entry.description,
    shopifyDevReference(entry, returnType, docsetEntryType),
  ]
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

const shopifyDevRoot = `https://shopify.dev/docs/api/liquid`;

function shopifyDevReference(
  entry: DocsetEntry,
  returnType?: PseudoType | ArrayType,
  docsetEntryType?: DocsetEntryType,
) {
  switch (docsetEntryType) {
    case 'tag': {
      if (entry.name === 'else' && 'category' in entry) {
        return `[Shopify Reference](${shopifyDevRoot}/tags/${entry.category}-${entry.name})`;
      } else if ('category' in entry) {
        return `[Shopify Reference](${shopifyDevRoot}/tags/${entry.name})`;
      } else {
        return undefined;
      }
    }

    case 'object': {
      if (!returnType) {
        return `[Shopify Reference](${shopifyDevRoot}/objects/${entry.name})`;
      } else if (isArrayType(returnType)) {
        return `[Shopify Reference](${shopifyDevRoot}/objects/${returnType.valueType})`;
      } else if ('access' in entry) {
        return `[Shopify Reference](${shopifyDevRoot}/objects/${returnType})`;
      } else {
        return undefined;
      }
    }

    case 'filter': {
      if ('category' in entry) {
        return `[Shopify Reference](${shopifyDevRoot}/filters/${entry.name})`;
      } else {
        return undefined;
      }
    }

    default: {
      return undefined;
    }
  }
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
