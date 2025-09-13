import { ConfigTarget, JSONCheckDefinition, LiquidCheckDefinition } from '../types';

import { AppBlockValidTags } from './app-block-valid-tags';
import { AssetPreload } from './asset-preload';
import { AssetSizeAppBlockCSS } from './asset-size-app-block-css';
import { AssetSizeAppBlockJavaScript } from './asset-size-app-block-javascript';
import { AssetSizeCSS } from './asset-size-css';
import { AssetSizeJavaScript } from './asset-size-javascript';
import { BlockIdUsage } from './block-id-usage';
import { CdnPreconnect } from './cdn-preconnect';
import { ContentForHeaderModification } from './content-for-header-modification';
import { DeprecateBgsizes } from './deprecate-bgsizes';
import { DeprecateLazysizes } from './deprecate-lazysizes';
import { DeprecatedFilter } from './deprecated-filter';
import { DeprecatedFontsOnSectionsAndBlocks } from './deprecated-fonts-on-sections-and-blocks';
import { DeprecatedFontsOnSettingsSchema } from './deprecated-fonts-on-settings-schema';
import { DeprecatedTag } from './deprecated-tag';
import { DuplicateRenderSnippetArguments } from './duplicate-render-snippet-arguments';
import { DuplicateContentForArguments } from './duplicate-content-for-arguments';
import { EmptyBlockContent } from './empty-block-content';
import { HardcodedRoutes } from './hardcoded-routes';
import { ImgWidthAndHeight } from './img-width-and-height';
import { JSONMissingBlock } from './json-missing-block';
import { JSONSyntaxError } from './json-syntax-error';
import { LiquidFreeSettings } from './liquid-free-settings';
import { LiquidHTMLSyntaxError } from './liquid-html-syntax-error';
import { MatchingTranslations } from './matching-translations';
import { MissingAsset } from './missing-asset';
import { MissingContentForArguments } from './missing-content-for-arguments';
import { MissingRenderSnippetArguments } from './missing-render-snippet-arguments';
import { MissingTemplate } from './missing-template';
import { OrphanedSnippet } from './orphaned-snippet';
import { PaginationSize } from './pagination-size';
import { ParserBlockingScript } from './parser-blocking-script';
import { SchemaPresetsBlockOrder } from './schema-presets-block-order';
import { SchemaPresetsStaticBlocks } from './schema-presets-static-blocks';
import { RemoteAsset } from './remote-asset';
import { RequiredLayoutThemeObject } from './required-layout-theme-object';
import { ReservedDocParamNames } from './reserved-doc-param-names';
import { StaticStylesheetAndJavascriptTags } from './static-stylesheet-and-javascript-tags';
import { TranslationKeyExists } from './translation-key-exists';
import { UnclosedHTMLElement } from './unclosed-html-element';
import { UndefinedObject } from './undefined-object';
import { UniqueDocParamNames } from './unique-doc-param-names';
import { UniqueStaticBlockId } from './unique-static-block-id';
import { UnknownFilter } from './unknown-filter';
import { UnrecognizedContentForArguments } from './unrecognized-content-for-arguments';
import { UnrecognizedRenderSnippetArguments } from './unrecognized-render-snippet-arguments';
import { UnusedAssign } from './unused-assign';
import { UnsupportedDocTag } from './unsupported-doc-tag';
import { UnusedDocParam } from './unused-doc-param';
import { ValidContentForArguments } from './valid-content-for-arguments';
import { ValidContentForArgumentTypes } from './valid-content-for-argument-types';
import { ValidBlockTarget } from './valid-block-target';
import { ValidHTMLTranslation } from './valid-html-translation';
import { ValidJSON } from './valid-json';
import { ValidDocParamTypes } from './valid-doc-param-types';
import { ValidLocalBlocks } from './valid-local-blocks';
import { ValidRenderSnippetArgumentTypes } from './valid-render-snippet-argument-types';
import { ValidSchema } from './valid-schema';
import { ValidSchemaName } from './valid-schema-name';
import { ValidSettingsKey } from './valid-settings-key';
import { ValidStaticBlockType } from './valid-static-block-type';
import { ValidVisibleIf, ValidVisibleIfSettingsSchema } from './valid-visible-if';
import { VariableName } from './variable-name';
import { AppBlockMissingSchema } from './app-block-missing-schema';
import { UniqueSettingIds } from './unique-settings-id';

export const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[] = [
  AppBlockValidTags,
  AssetPreload,
  AssetSizeAppBlockCSS,
  AssetSizeAppBlockJavaScript,
  AssetSizeCSS,
  AssetSizeJavaScript,
  BlockIdUsage,
  CdnPreconnect,
  ContentForHeaderModification,
  DeprecateBgsizes,
  DeprecateLazysizes,
  DeprecatedFilter,
  DeprecatedFontsOnSectionsAndBlocks,
  DeprecatedFontsOnSettingsSchema,
  DeprecatedTag,
  DuplicateContentForArguments,
  DuplicateRenderSnippetArguments,
  EmptyBlockContent,
  HardcodedRoutes,
  ImgWidthAndHeight,
  JSONMissingBlock,
  JSONSyntaxError,
  LiquidFreeSettings,
  LiquidHTMLSyntaxError,
  MatchingTranslations,
  MissingAsset,
  MissingContentForArguments,
  MissingRenderSnippetArguments,
  MissingTemplate,
  AppBlockMissingSchema,
  OrphanedSnippet,
  PaginationSize,
  ParserBlockingScript,
  SchemaPresetsBlockOrder,
  SchemaPresetsStaticBlocks,
  RemoteAsset,
  RequiredLayoutThemeObject,
  ReservedDocParamNames,
  StaticStylesheetAndJavascriptTags,
  TranslationKeyExists,
  UnclosedHTMLElement,
  UndefinedObject,
  UniqueDocParamNames,
  UniqueSettingIds,
  UniqueStaticBlockId,
  UnknownFilter,
  UnrecognizedContentForArguments,
  UnrecognizedRenderSnippetArguments,
  UnsupportedDocTag,
  UnusedAssign,
  UnusedDocParam,
  ValidBlockTarget,
  ValidHTMLTranslation,
  ValidContentForArguments,
  ValidContentForArgumentTypes,
  ValidJSON,
  ValidDocParamTypes,
  ValidLocalBlocks,
  ValidRenderSnippetArgumentTypes,
  ValidSchema,
  ValidSettingsKey,
  ValidStaticBlockType,
  ValidVisibleIf,
  ValidVisibleIfSettingsSchema,
  VariableName,
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
