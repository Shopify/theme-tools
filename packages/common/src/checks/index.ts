import { JSONCheckDefinition, LiquidCheckDefinition } from '@shopify/theme-check-common';
import { ParserBlockingScript } from './parser-blocking-script';
import { MatchingTranslations } from './matching-translations';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  ParserBlockingScript,
  MatchingTranslations,
];

export const recommended = allChecks.filter(
  (check) => check.meta.docs.recommended,
);
