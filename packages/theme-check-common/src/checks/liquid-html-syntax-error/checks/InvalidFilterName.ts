import {
  LiquidVariableOutput,
  LiquidTag,
  LiquidVariable,
  NodeTypes,
  NamedTags,
} from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType, Context, FilterEntry } from '../../..';
import { INVALID_SYNTAX_MESSAGE } from './utils';

export async function detectInvalidFilterName(
  node: LiquidVariableOutput | LiquidTag,
  filters: FilterEntry[] | undefined,
): Promise<Problem<SourceCodeType.LiquidHtml>[]> {
  if (!filters) {
    return [];
  }

  if (node.type === NodeTypes.LiquidVariableOutput) {
    // When the markup parses cleanly the parser hands us a structured
    // `LiquidVariable`; only a bail-out leaves the raw markup as a string.
    // Both carry the same offenses, they just live in different places.
    if (typeof node.markup === 'string') {
      return detectInvalidFilterNameInMarkup(node, node.markup, filters);
    }
    return detectInvalidFilterNameInFilters(node, node.markup, filters);
  }

  if (node.type === NodeTypes.LiquidTag) {
    if (node.name === NamedTags.echo) {
      if (typeof node.markup === 'string') {
        return detectInvalidFilterNameInMarkup(node, node.markup, filters);
      }
      if (node.markup.type === NodeTypes.LiquidVariable) {
        return detectInvalidFilterNameInFilters(node, node.markup, filters);
      }
    }

    if (node.name === NamedTags.assign) {
      if (typeof node.markup === 'string') {
        return detectInvalidFilterNameInMarkup(node, node.markup, filters);
      }
      if (node.markup.type === NodeTypes.AssignMarkup) {
        return detectInvalidFilterNameInFilters(node, node.markup.value, filters);
      }
    }
  }

  return [];
}

// When the tokenizer meets an invalid trailing character (`@`, `!`, `#`, ...)
// it silently drops the byte, so the filter parses cleanly and the markup ends
// up as a structured `LiquidVariable` — the raw-markup regex above never sees
// it. The dropped byte still lives in the document `source` right after the
// filter name, so we recover the offense from the source span instead.
async function detectInvalidFilterNameInFilters(
  node: LiquidVariableOutput | LiquidTag,
  variable: LiquidVariable,
  filters: FilterEntry[],
): Promise<Problem<SourceCodeType.LiquidHtml>[]> {
  const knownFilters = filters;
  const source = node.source;
  const markupEnd = variable.position.end;
  const problems: Problem<SourceCodeType.LiquidHtml>[] = [];

  for (const filter of variable.filters) {
    if (!knownFilters.some((known) => known.name === filter.name)) {
      continue;
    }

    // `filter.position.start` sits before this filter's pipe, so the first
    // occurrence of the name from there is this filter's name.
    const nameStartInSource = source.indexOf(filter.name, filter.position.start);
    if (nameStartInSource === -1) {
      continue;
    }

    const trailingStartInSource = nameStartInSource + filter.name.length;

    // Capture the run of characters wedged between the filter name and its
    // next valid boundary (whitespace, `:` before arguments, `|` before the
    // next filter, or the end of the markup). Anything there is junk.
    const trailing = source.slice(trailingStartInSource, markupEnd).match(/^([^\s:|]+)/)?.[1];
    if (!trailing) {
      continue;
    }

    const trailingEndInSource = trailingStartInSource + trailing.length;

    problems.push({
      message: `${INVALID_SYNTAX_MESSAGE} Filter '${filter.name}' has trailing characters '${trailing}' that should be removed.`,
      startIndex: trailingStartInSource,
      endIndex: trailingEndInSource,
      fix: (corrector) => {
        corrector.replace(trailingStartInSource, trailingEndInSource, '');
      },
    });
  }

  return problems;
}

async function detectInvalidFilterNameInMarkup(
  node: LiquidVariableOutput | LiquidTag,
  markup: string,
  filters: FilterEntry[],
): Promise<Problem<SourceCodeType.LiquidHtml>[]> {
  const knownFilters = filters;
  const trimmedMarkup = markup.trim();
  const problems: Problem<SourceCodeType.LiquidHtml>[] = [];

  const filterPattern = /\|\s*([a-zA-Z][a-zA-Z0-9_]*)/g;
  const matches = Array.from(trimmedMarkup.matchAll(filterPattern));

  for (const match of matches) {
    const filterName = match[1];

    if (!knownFilters.some((filter) => filter.name === filterName)) {
      continue;
    }

    const filterEndIndex = match.index! + match[0].length;
    const afterFilter = trimmedMarkup.slice(filterEndIndex);

    // This regex finds invalid trailing characters after a filter name using lookaheads:
    // 1. Skip valid syntax like ": parameter" or "| nextfilter"
    // 2. Capture any junk characters that shouldn't be there
    // 3. Stop before valid boundaries like colons or pipes
    // e.g. "upcase xyz" finds "xyz", but "upcase | downcase" is ignored as valid
    const invalidSegment = afterFilter.match(
      /^(?!\s*(?::|$|\|\s*[a-zA-Z]|\|\s*\||\s*\|\s*(?:[}%]|$)))([^:|]+?)(?=\s*(?::|$|\|))/,
    )?.[1];
    if (!invalidSegment) {
      continue;
    }

    const markupStartInSource = node.source.indexOf(markup, node.position.start);
    const trailingStartInSource = markupStartInSource + filterEndIndex;
    const trailingEndInSource = trailingStartInSource + invalidSegment.length;

    problems.push({
      message: `${INVALID_SYNTAX_MESSAGE} Filter '${filterName}' has trailing characters '${invalidSegment}' that should be removed.`,
      startIndex: trailingStartInSource,
      endIndex: trailingEndInSource,
      fix: (corrector) => {
        corrector.replace(trailingStartInSource, trailingEndInSource, '');
      },
    });
  }

  return problems;
}
