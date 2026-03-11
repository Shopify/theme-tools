import { LiquidFilter } from '@shopify/liquid-html-parser';
import { Fixer, LiquidHtmlSuggestion, SourceCodeType } from '../../types';
type Suggestion = LiquidHtmlSuggestion[] | undefined;
export declare function fixHexToRgba(node: LiquidFilter): Fixer<SourceCodeType.LiquidHtml> | undefined;
export declare function suggestImgTagFix(node: LiquidFilter): Suggestion;
export declare function suggestImgUrlFix(node: LiquidFilter): Suggestion;
export declare function suggestImageUrlFix(filter: string, node: LiquidFilter): Suggestion;
export {};
