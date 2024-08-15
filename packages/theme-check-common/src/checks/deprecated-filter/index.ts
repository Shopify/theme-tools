import { LiquidFilter } from '@shopify/liquid-html-parser';
import {
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
  LiquidHtmlSuggestion,
  FilterEntry,
  Fixer,
} from '../../types';
import { fixHexToRgba, suggestImageUrlFix, suggestImgTagFix, suggestImgUrlFix } from './fixes';

export const DeprecatedFilter: LiquidCheckDefinition = {
  meta: {
    code: 'DeprecatedFilter',
    aliases: ['DeprecatedFilters'],
    name: 'Deprecated Filter',
    docs: {
      description: 'Discourages using deprecated filters in themes.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/deprecated-filter',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    if (!context.themeDocset) {
      return {};
    }

    return {
      LiquidFilter: async (node: LiquidFilter) => {
        const filters = await context.themeDocset!.filters();

        const deprecatedFilter = filters.find((f) => {
          return f.deprecated && f.name === node.name;
        });

        if (!deprecatedFilter) {
          return;
        }

        const recommendedFilterName = findRecommendedAlternative(deprecatedFilter);
        const recommendedFilter = filters.find((f) => f.name === recommendedFilterName);

        const message = deprecatedFilterMessage(deprecatedFilter, recommendedFilter);
        const suggest = deprecatedFilterSuggestion(node);
        const fix = deprecatedFilterFix(node);

        context.report({
          message,
          suggest,
          fix,
          startIndex: node.position.start + 1,
          endIndex: node.position.end,
        });
      },
    };
  },
};

function deprecatedFilterSuggestion(node: LiquidFilter): LiquidHtmlSuggestion[] | undefined {
  const filter = node.name;

  switch (filter) {
    case 'img_tag':
      return suggestImgTagFix(node);
    case 'img_url':
      return suggestImgUrlFix(node);
    case 'article_img_url':
    case 'collection_img_url':
    case 'product_img_url':
      /**
       * These filters rely on the usage of the `image_url`
       * filter as the fix.
       */
      return suggestImageUrlFix(filter, node);
    case 'currency_selector':
      /**
       * Cannot be fixed.
       *
       * Deprecated without a direct replacement because the
       * currency form has also been deprecated. The currency
       * form was replaced by the localization form.
       */
      return;
  }
}

function deprecatedFilterFix(node: LiquidFilter): Fixer<SourceCodeType.LiquidHtml> | undefined {
  const filter = node.name;

  if (filter === 'hex_to_rgba') {
    return fixHexToRgba(node);
  }
}

function deprecatedFilterMessage(deprecated: FilterEntry, recommended?: FilterEntry) {
  if (recommended) {
    return `Deprecated filter '${deprecated.name}', consider using '${recommended.name}'.`;
  }

  return `Deprecated filter '${deprecated.name}'.`;
}

function findRecommendedAlternative(deprecatedFilter: FilterEntry) {
  const reason = deprecatedFilter.deprecation_reason;
  const match = reason?.match(/replaced by \[`(.+?)`\]/);

  return match?.[1];
}
