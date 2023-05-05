import { JSONCheckDefinition, LiquidCheckDefinition } from '@shopify/theme-check-common';

import { MatchingTranslations } from './matching-translations';
import { MissingTemplate } from './missing-template';
import { ParserBlockingScript } from './parser-blocking-script';
import { TranslationKeyExists } from './translation-key-exists';
import { UnusedAssign } from './unused-assign';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  UnusedAssign,
  ParserBlockingScript,
  MatchingTranslations,
  MissingTemplate,
  TranslationKeyExists,
];

export const recommended = allChecks.filter((check) => check.meta.docs.recommended);
