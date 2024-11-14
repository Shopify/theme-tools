import {
  SourceCodeType,
  SourceCode,
  SectionSchema,
  BlockSchema,
} from '@shopify/theme-check-common';
import { TextDocument } from 'vscode-languageserver-textdocument';

/** Util type to add the common `textDocument` property to the SourceCode. */
type _AugmentedSourceCode<SCT extends SourceCodeType = SourceCodeType> = SourceCode<SCT> & {
  textDocument: TextDocument;
};

/** JsonSourceCode + textDocument */
export type AugmentedJsonSourceCode = _AugmentedSourceCode<SourceCodeType.JSON>;

/**
 * AugmentedLiquidSourceCode may hold the schema for the section or block.
 *
 * We'll use the SourceCode as the source of truth since we won't need to care
 * about cache invalidation and will mean we'll parse the schema at most once.
 */
export type AugmentedLiquidSourceCode = _AugmentedSourceCode<SourceCodeType.LiquidHtml> & {
  schema?: SectionSchema | BlockSchema;
};

/**
 * AugmentedSourceCode is a union of the two augmented source codes.
 *
 * When passed a specific SourceCodeType, it will return the correct AugmentedSourceCode.
 *
 * @example
 * AugmentedSourceCode -> AugmentedJsonSourceCode | AugmentedLiquidSourceCode
 * AugmentedSourceCode<SourceCodeType.JSON> -> AugmentedJsonSourceCode
 * AugmentedSourceCode<SourceCodeType.LiquidHtml> -> AugmentedLiquidSourceCode
 */
export type AugmentedSourceCode<SCT extends SourceCodeType = SourceCodeType> = {
  [SourceCodeType.JSON]: AugmentedJsonSourceCode;
  [SourceCodeType.LiquidHtml]: AugmentedLiquidSourceCode;
}[SCT];
