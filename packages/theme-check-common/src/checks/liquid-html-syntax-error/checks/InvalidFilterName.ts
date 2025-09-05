import { LiquidFilter, NodeTypes } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType, Context } from '../../..';
import { INVALID_SYNTAX_MESSAGE } from './utils';

export async function detectInvalidFilterName(
  node: LiquidFilter,
  context: Context<SourceCodeType.LiquidHtml>,
): Promise<Problem<SourceCodeType.LiquidHtml> | undefined> {
  if (node.type !== NodeTypes.LiquidFilter || !context.themeDocset) {
    return;
  }

  const filterName = node.name;
  const knownFilters = await context.themeDocset.filters();

  let matchingFilter = null;
  let longestMatchLength = 0;

  for (const filter of knownFilters) {
    if (filterName.startsWith(filter.name) && filter.name.length > longestMatchLength) {
      matchingFilter = filter;
      longestMatchLength = filter.name.length;
    }
  }

  if (!matchingFilter) {
    return;
  }

  if (filterName === matchingFilter.name) {
    return;
  }

  const baseFilterName = matchingFilter.name;
  const trailingPart = filterName.substring(baseFilterName.length);

  const containsAlphanumeric = /[a-zA-Z0-9]/.test(trailingPart);

  // Filter doesn't activate when there are alphanumeric characters - we remove the entire filter
  if (containsAlphanumeric) {
    return {
      message: `${INVALID_SYNTAX_MESSAGE}: Filter '${filterName}' is not being activated because of trailing characters '${trailingPart}'. The filter will be ignored.`,
      startIndex: node.position.start,
      endIndex: node.position.end,
      fix: (corrector) => {
        corrector.replace(node.position.start, node.position.end, '');
      },
    };
  } else {
    // Filter activates on special characters and spaces - we only remove the trailing characters
    return {
      message: `${INVALID_SYNTAX_MESSAGE}: Filter '${baseFilterName}' has trailing characters '${trailingPart}' that should be removed.`,
      startIndex: node.position.start + 1,
      endIndex: node.position.end,
      fix: (corrector) => {
        corrector.replace(node.position.start + 1, node.position.end, baseFilterName);
      },
    };
  }
}
