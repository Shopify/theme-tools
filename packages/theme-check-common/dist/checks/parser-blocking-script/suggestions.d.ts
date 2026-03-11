import { HtmlRawNode, LiquidFilter, LiquidVariable, LiquidVariableOutput } from '@shopify/liquid-html-parser';
import { LiquidHtmlSuggestion } from '../../types';
export declare const liquidFilterSuggestion: (attr: "defer" | "async", node: LiquidFilter, parentNode: LiquidVariable, grandParentNode: LiquidVariableOutput) => LiquidHtmlSuggestion;
export declare const scriptTagSuggestion: (attr: "defer" | "async", node: HtmlRawNode) => LiquidHtmlSuggestion;
