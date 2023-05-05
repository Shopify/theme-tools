import { JSONCheckDefinition, LiquidCheckDefinition } from '@shopify/theme-check-common';

import { MatchingTranslations } from './matching-translations';
import { MissingTemplate } from './missing-template';
import { ParserBlockingScript } from './parser-blocking-script';
import { RequiredLayoutThemeObject } from './required-layout-theme-object';
import { TranslationKeyExists } from './translation-key-exists';
import { UnusedAssign } from './unused-assign';
import { DeprecateBgsizes } from './deprecate-bgsizes';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  DeprecateBgsizes,
  MatchingTranslations,
  MissingTemplate,
  ParserBlockingScript,
  RequiredLayoutThemeObject,
  TranslationKeyExists,
  UnusedAssign,
];

export const recommended = allChecks.filter((check) => check.meta.docs.recommended);
