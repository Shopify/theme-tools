import { JSONCheckDefinition, LiquidCheckDefinition } from '@shopify/theme-check-common';

import { DeprecateBgsizes } from './deprecate-bgsizes';
import { DeprecateLazysizes } from './deprecate-lazysizes';
import { JSONSyntaxError } from './json-syntax-error';
import { LiquidHTMLSyntaxError } from './liquid-html-syntax-error';
import { MatchingTranslations } from './matching-translations';
import { MissingTemplate } from './missing-template';
import { ParserBlockingScript } from './parser-blocking-script';
import { RequiredLayoutThemeObject } from './required-layout-theme-object';
import { TranslationKeyExists } from './translation-key-exists';
import { UnusedAssign } from './unused-assign';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  DeprecateBgsizes,
  DeprecateLazysizes,
  JSONSyntaxError,
  LiquidHTMLSyntaxError,
  MatchingTranslations,
  MissingTemplate,
  ParserBlockingScript,
  RequiredLayoutThemeObject,
  TranslationKeyExists,
  UnusedAssign,
];

export const recommended = allChecks.filter((check) => check.meta.docs.recommended);
