import { ConfigTarget, JSONCheckDefinition, LiquidCheckDefinition } from '../types';

import { AppBlockValidTags } from './app-block-valid-tags';
import { AssetPreload } from './asset-preload';
import { AssetSizeAppBlockCSS } from './asset-size-app-block-css';
import { AssetSizeAppBlockJavaScript } from './asset-size-app-block-javascript';
import { AssetSizeCSS } from './asset-size-css';
import { AssetSizeJavaScript } from './asset-size-javascript';
import { BlockIdUsage } from './block-id-usage';
import { CaptureOnContentForBlock } from './capture-on-content-for-block';
import { CdnPreconnect } from './cdn-preconnect';
import { ContentForHeaderModification } from './content-for-header-modification';
import { DeprecateBgsizes } from './deprecate-bgsizes';
import { DeprecateLazysizes } from './deprecate-lazysizes';
import { DeprecatedFilter } from './deprecated-filter';
import { DeprecatedTag } from './deprecated-tag';
import { EmptyBlockContent } from './empty-block-content';
import { ImgWidthAndHeight } from './img-width-and-height';
import { JSONMissingBlock } from './json-missing-block';
import { JSONSyntaxError } from './json-syntax-error';
import { LiquidFreeSettings } from './liquid-free-settings';
import { LiquidHTMLSyntaxError } from './liquid-html-syntax-error';
import { MatchingTranslations } from './matching-translations';
import { MissingAsset } from './missing-asset';
import { MissingTemplate } from './missing-template';
import { PaginationSize } from './pagination-size';
import { ParserBlockingScript } from './parser-blocking-script';
import { SchemaPresetsBlockOrder } from './schema-presets-block-order';
import { SchemaPresetsStaticBlocks } from './schema-presets-static-blocks';
import { RemoteAsset } from './remote-asset';
import { RequiredLayoutThemeObject } from './required-layout-theme-object';
import { TranslationKeyExists } from './translation-key-exists';
import { UnclosedHTMLElement } from './unclosed-html-element';
import { UndefinedObject } from './undefined-object';
import { UniqueDocParamNames } from './unique-doc-param-names';
import { UniqueStaticBlockId } from './unique-static-block-id';
import { UnknownFilter } from './unknown-filter';
import { UnusedAssign } from './unused-assign';
import { UnsupportedDocTag } from './unsupported-doc-tag';
import { UnusedDocParam } from './unused-doc-param';
import { ValidContentForArguments } from './valid-content-for-arguments';
import { ValidBlockTarget } from './valid-block-target';
import { ValidHTMLTranslation } from './valid-html-translation';
import { ValidJSON } from './valid-json';
import { ValidDocParamNames } from './valid-doc-param-names';
import { ValidDocParamTypes } from './valid-doc-param-types';
import { ValidLocalBlocks } from './valid-local-blocks';
import { MissingRenderSnippetParams } from './missing-render-snippet-params';
import { UnrecognizedRenderSnippetParams } from './unrecognized-render-snippet-params';
import { ValidRenderSnippetParamTypes } from './valid-render-snippet-param-types';
import { ValidSchema } from './valid-schema';
import { ValidSchemaName } from './valid-schema-name';
import { ValidSettingsKey } from './valid-settings-key';
import { ValidStaticBlockType } from './valid-static-block-type';
import { ValidVisibleIf, ValidVisibleIfSettingsSchema } from './valid-visible-if';
import { VariableName } from './variable-name';
import { AppBlockMissingSchema } from './app-block-missing-schema';
import { UniqueSettingIds } from './unique-settings-id';
import { DuplicateRenderSnippetParams } from './duplicate-render-snippet-params';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  AppBlockValidTags,
  AssetPreload,
  AssetSizeAppBlockCSS,
  AssetSizeAppBlockJavaScript,
  AssetSizeCSS,
  AssetSizeJavaScript,
  BlockIdUsage,
  CaptureOnContentForBlock,
  CdnPreconnect,
  ContentForHeaderModification,
  DeprecateBgsizes,
  DeprecatedFilter,
  DeprecatedTag,
  DeprecateLazysizes,
  DuplicateRenderSnippetParams,
  EmptyBlockContent,
  ImgWidthAndHeight,
  JSONMissingBlock,
  JSONSyntaxError,
  LiquidFreeSettings,
  LiquidHTMLSyntaxError,
  MatchingTranslations,
  MissingAsset,
  MissingTemplate,
  AppBlockMissingSchema,
  PaginationSize,
  ParserBlockingScript,
  SchemaPresetsBlockOrder,
  SchemaPresetsStaticBlocks,
  RemoteAsset,
  RequiredLayoutThemeObject,
  TranslationKeyExists,
  UnclosedHTMLElement,
  UndefinedObject,
  UniqueDocParamNames,
  UniqueSettingIds,
  UniqueStaticBlockId,
  UnknownFilter,
  UnsupportedDocTag,
  UnusedAssign,
  UnusedDocParam,
  ValidBlockTarget,
  ValidHTMLTranslation,
  ValidContentForArguments,
  ValidJSON,
  ValidDocParamNames,
  ValidDocParamTypes,
  ValidLocalBlocks,
  ValidSchema,
  ValidSettingsKey,
  ValidStaticBlockType,
  ValidVisibleIf,
  ValidVisibleIfSettingsSchema,
  VariableName,
  MissingRenderSnippetParams,
  UnrecognizedRenderSnippetParams,
  ValidRenderSnippetParamTypes,
  ValidSchemaName,
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
