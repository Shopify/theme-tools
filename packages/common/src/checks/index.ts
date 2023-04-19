import { JSONCheckDefinition, LiquidCheckDefinition } from '@shopify/theme-check-common';
import { ParserBlockingScript } from './parser-blocking-script';
import { MatchingTranslations } from './matching-translations';
import { MissingTemplate } from './missing-template';
import { TranslationKeyExists } from './translation-key-exists';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  ParserBlockingScript,
  MatchingTranslations,
  MissingTemplate,
  TranslationKeyExists,
];

export const recommended = allChecks.filter((check) => check.meta.docs.recommended);
