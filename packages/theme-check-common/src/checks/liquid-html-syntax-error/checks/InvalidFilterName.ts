import { LiquidVariableOutput, LiquidTag, NodeTypes, NamedTags } from '@shopify/liquid-html-parser';
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
    if (typeof node.markup !== 'string') {
      return [];
    }
    return detectInvalidFilterNameInMarkup(node, node.markup, filters);
  }

  if (node.type === NodeTypes.LiquidTag) {
    if (node.name === NamedTags.echo && typeof node.markup !== 'string') {
      return [];
    }
    if (node.name === NamedTags.assign && typeof node.markup !== 'string') {
      return [];
    }
    if (
      typeof node.markup === 'string' &&
      (node.name === NamedTags.echo || node.name === NamedTags.assign)
    ) {
      return detectInvalidFilterNameInMarkup(node, node.markup, filters);
    }
  }

  return [];
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
