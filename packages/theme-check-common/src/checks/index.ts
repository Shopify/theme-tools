import { ConfigTarget, JSONCheckDefinition, LiquidCheckDefinition } from '../types';

import { AppBlockValidTags } from './app-block-valid-tags';
import { AssetPreload } from './asset-preload';
import { AssetSizeAppBlockCSS } from './asset-size-app-block-css';
import { AssetSizeAppBlockJavaScript } from './asset-size-app-block-javascript';
import { AssetSizeCSS } from './asset-size-css';
import { AssetSizeJavaScript } from './asset-size-javascript';
import { CdnPreconnect } from './cdn-preconnect';
import { CaptureOnContentForBlock } from './capture-on-content-for-block';
import { ContentForHeaderModification } from './content-for-header-modification';
import { DeprecateBgsizes } from './deprecate-bgsizes';
import { DeprecateLazysizes } from './deprecate-lazysizes';
import { DeprecatedFilter } from './deprecated-filter';
import { DeprecatedTag } from './deprecated-tag';
import { ImgWidthAndHeight } from './img-width-and-height';
import { JSONSyntaxError } from './json-syntax-error';
import { LiquidHTMLSyntaxError } from './liquid-html-syntax-error';
import { MatchingTranslations } from './matching-translations';
import { MissingAsset } from './missing-asset';
import { MissingTemplate } from './missing-template';
import { PaginationSize } from './pagination-size';
import { ParserBlockingScript } from './parser-blocking-script';
import { RemoteAsset } from './remote-asset';
import { RequiredLayoutThemeObject } from './required-layout-theme-object';
import { SpaceAroundClassList } from './space-around-class_list';
import { TranslationKeyExists } from './translation-key-exists';
import { UnclosedHTMLElement } from './unclosed-html-element';
import { UndefinedObject } from './undefined-object';
import { UnknownFilter } from './unknown-filter';
import { UnusedAssign } from './unused-assign';
import { ValidHTMLTranslation } from './valid-html-translation';
import { ValidSchema } from './valid-schema';
import { ValidJSON } from './valid-json';
import { VariableName } from './variable-name';
import { ValidStaticBlockType } from './valid-static-block-type';
import { UniqueStaticBlockId } from './unique-static-block-id';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  AppBlockValidTags,
  AssetPreload,
  AssetSizeAppBlockCSS,
  AssetSizeAppBlockJavaScript,
  AssetSizeCSS,
  AssetSizeJavaScript,
  CaptureOnContentForBlock,
  CdnPreconnect,
  ContentForHeaderModification,
  DeprecateBgsizes,
  DeprecatedFilter,
  DeprecatedTag,
  DeprecateLazysizes,
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
  SpaceAroundClassList,
  TranslationKeyExists,
  UnclosedHTMLElement,
  UndefinedObject,
  UniqueStaticBlockId,
  UnknownFilter,
  UnusedAssign,
  ValidHTMLTranslation,
  ValidJSON,
  ValidSchema,
  ValidStaticBlockType,
  VariableName,
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
