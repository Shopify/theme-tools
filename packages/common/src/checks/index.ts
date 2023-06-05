import { JSONCheckDefinition, LiquidCheckDefinition } from '@shopify/theme-check-common';

import { DeprecateBgsizes } from './deprecate-bgsizes';
import { CdnPreconnect } from './cdn-preconnect';
import { DeprecateLazysizes } from './deprecate-lazysizes';
import { JSONSyntaxError } from './json-syntax-error';
import { LiquidHTMLSyntaxError } from './liquid-html-syntax-error';
import { MatchingTranslations } from './matching-translations';
import { MissingTemplate } from './missing-template';
import { ParserBlockingScript } from './parser-blocking-script';
import { RequiredLayoutThemeObject } from './required-layout-theme-object';
import { TranslationKeyExists } from './translation-key-exists';
import { UnusedAssign } from './unused-assign';
import { ImgWidthAndHeight } from './img-width-and-height';
import { AssetUrlFilters } from './asset-url-filters';
import { MissingAsset } from './missing-asset';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  AssetUrlFilters,
  CdnPreconnect,
  DeprecateBgsizes,
  DeprecateLazysizes,
  ImgWidthAndHeight,
  JSONSyntaxError,
  LiquidHTMLSyntaxError,
  MatchingTranslations,
  MissingAsset,
  MissingTemplate,
  ParserBlockingScript,
  RequiredLayoutThemeObject,
  TranslationKeyExists,
  UnusedAssign,
];

export const recommended = allChecks.filter((check) => check.meta.docs.recommended);
