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
import { PaginationSize } from './pagination-size';
import { ValidHTMLTranslation } from './valid-html-translation';
import { ImgLazyLoading } from './img-lazy-loading';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  AssetUrlFilters,
  CdnPreconnect,
  DeprecateBgsizes,
  DeprecateLazysizes,
  ImgLazyLoading,
  ImgWidthAndHeight,
  JSONSyntaxError,
  LiquidHTMLSyntaxError,
  MatchingTranslations,
  MissingAsset,
  MissingTemplate,
  PaginationSize,
  ParserBlockingScript,
  RequiredLayoutThemeObject,
  TranslationKeyExists,
  UnusedAssign,
  ValidHTMLTranslation,
];

export const recommended = allChecks.filter((check) => check.meta.docs.recommended);
