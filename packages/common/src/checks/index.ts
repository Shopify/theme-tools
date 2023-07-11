import {
  ConfigTarget,
  JSONCheckDefinition,
  LiquidCheckDefinition,
} from '@shopify/theme-check-common';

import { AppBlockValidTags } from './app-block-valid-tags';
import { AssetPreload } from './asset-preload';
import { AssetUrlFilters } from './asset-url-filters';
import { CdnPreconnect } from './cdn-preconnect';
import { DeprecateBgsizes } from './deprecate-bgsizes';
import { DeprecateLazysizes } from './deprecate-lazysizes';
import { ImgLazyLoading } from './img-lazy-loading';
import { ImgWidthAndHeight } from './img-width-and-height';
import { JSONSyntaxError } from './json-syntax-error';
import { LiquidHTMLSyntaxError } from './liquid-html-syntax-error';
import { MatchingTranslations } from './matching-translations';
import { MissingAsset } from './missing-asset';
import { MissingTemplate } from './missing-template';
import { PaginationSize } from './pagination-size';
import { ParserBlockingScript } from './parser-blocking-script';
import { RequiredLayoutThemeObject } from './required-layout-theme-object';
import { TranslationKeyExists } from './translation-key-exists';
import { UnusedAssign } from './unused-assign';
import { ValidHTMLTranslation } from './valid-html-translation';
// import { ValidSchema } from './valid-schema';
import { UnknownFilter } from './unknown-filter';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  AppBlockValidTags,
  AssetPreload,
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
  UnknownFilter,
  UnusedAssign,
  ValidHTMLTranslation,
  // ValidSchema,
];

/**
 * The recommended checks is populated by all checks with the following conditions:
 * - meta.docs.recommended: true
 * - Either no meta.targets list exist or if it does exist then Recommended is a target
 */
export const recommended = allChecks.filter((check) => {
  const isRecommended = check.meta.docs.recommended;
  const isValidTarget =
    !check.meta.targets ||
    !check.meta.targets.length ||
    check.meta.targets.includes(ConfigTarget.Recommended);

  return isRecommended && isValidTarget;
});
