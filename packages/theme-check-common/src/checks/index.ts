import { ConfigTarget, JSONCheckDefinition, LiquidCheckDefinition } from '../types';

import { AppBlockValidTags } from './app-block-valid-tags';
import { AssetPreload } from './asset-preload';
import { RemoteAsset } from './remote-asset';
import { CdnPreconnect } from './cdn-preconnect';
import { DeprecateBgsizes } from './deprecate-bgsizes';
import { DeprecateLazysizes } from './deprecate-lazysizes';
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
import { UnknownFilter } from './unknown-filter';
import { UnusedAssign } from './unused-assign';
import { ValidHTMLTranslation } from './valid-html-translation';
import { ValidSchema } from './valid-schema';
import { ContentForHeaderModification } from './content-for-header-modification';
import { AssetSizeAppBlockCSS } from './asset-size-app-block-css';
import { AssetSizeAppBlockJavaScript } from './asset-size-app-block-javascript';
import { AssetSizeCSS } from './asset-size-css';
import { DeprecatedFilter } from './deprecated-filter';
import { DeprecatedTag } from './deprecated-tag';
import { AssetSizeJavaScript } from './asset-size-javascript';
import { UndefinedObject } from './undefined-object';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  AppBlockValidTags,
  AssetPreload,
  AssetSizeAppBlockCSS,
  AssetSizeAppBlockJavaScript,
  AssetSizeCSS,
  AssetSizeJavaScript,
  CdnPreconnect,
  ContentForHeaderModification,
  DeprecateBgsizes,
  DeprecateLazysizes,
  DeprecatedFilter,
  DeprecatedTag,
  ImgWidthAndHeight,
  JSONSyntaxError,
  LiquidHTMLSyntaxError,
  MatchingTranslations,
  MissingAsset,
  MissingTemplate,
  PaginationSize,
  ParserBlockingScript,
  RemoteAsset,
  RequiredLayoutThemeObject,
  TranslationKeyExists,
  UndefinedObject,
  UnknownFilter,
  UnusedAssign,
  ValidHTMLTranslation,
  ValidSchema,
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
