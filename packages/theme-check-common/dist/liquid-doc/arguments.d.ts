/**
 * Helper methods shared between `render` tag and `content_for` tag to report
 * errors when LiquidDoc exists
 */
import { ContentForMarkup, RenderMarkup, LiquidNamedArgument } from '@shopify/liquid-html-parser';
import { Context, LiquidDocParameter, SourceCodeType, StringCorrector } from '..';
/**
 * Report error when unknown arguments are provided for `content_for` tag or `render` tag
 */
export declare function reportUnknownArguments(context: Context<SourceCodeType.LiquidHtml>, node: ContentForMarkup | RenderMarkup, unknownProvidedArgs: LiquidNamedArgument[], name: string): void;
/**
 * Report error when missing arguments are provided for `content_for` tag or `render` tag
 */
export declare function reportMissingArguments(context: Context<SourceCodeType.LiquidHtml>, node: ContentForMarkup | RenderMarkup, missingRequiredArgs: LiquidDocParameter[], name: string): void;
export declare function reportDuplicateArguments(context: Context<SourceCodeType.LiquidHtml>, node: ContentForMarkup | RenderMarkup, duplicateArgs: LiquidNamedArgument[], name: string): void;
/**
 * Find type mismatch between the arguments provided for `content_for` tag and `render` tag
 * and their associated file's LiquidDoc
 */
export declare function findTypeMismatchParams(liquidDocParameters: Map<string, LiquidDocParameter>, providedParams: LiquidNamedArgument[]): LiquidNamedArgument[];
/**
 * Report error if the type mismatches between LiquidDoc and provided arguments
 */
export declare function reportTypeMismatches(context: Context<SourceCodeType.LiquidHtml>, typeMismatchArgs: LiquidNamedArgument[], liquidDocParameters: Map<string, LiquidDocParameter>): void;
/**
 * Generates suggestions for type mismatches based on the expected type and node positions
 */
export declare function generateTypeMismatchSuggestions(expectedType: string, startPosition: number, endPosition: number): {
    message: string;
    fix: (fixer: StringCorrector) => void;
}[];
export declare function getBlockName(node: ContentForMarkup): string | undefined;
export declare function getSnippetName(node: RenderMarkup): string | undefined;
export declare function getLiquidDocParams(context: Context<SourceCodeType.LiquidHtml>, relativePath: string): Promise<Map<string, LiquidDocParameter> | undefined>;
export declare function makeRemoveArgumentCorrector(node: ContentForMarkup | RenderMarkup, arg: LiquidNamedArgument): (fixer: StringCorrector) => void;
export declare function makeAddArgumentCorrector(node: ContentForMarkup | RenderMarkup, arg: LiquidDocParameter): (fixer: StringCorrector) => void;
