import { LiquidHtmlNode, LiquidRawTag } from '@shopify/liquid-html-parser';
import { JSONNode } from '@shopify/theme-check-common';
import { AugmentedJsonSourceCode, AugmentedLiquidSourceCode, AugmentedSourceCode } from '../documents';
export type RequestContext = {
    doc: AugmentedSourceCode;
    schema?: LiquidRawTag;
    parsed?: any | Error;
};
export type LiquidRequestContext = {
    doc: Omit<AugmentedLiquidSourceCode, 'ast'> & {
        ast: LiquidHtmlNode;
    };
    schema: LiquidRawTag;
    parsed: any;
};
export type JSONRequestContext = {
    doc: Omit<AugmentedJsonSourceCode, 'ast'> & {
        ast: JSONNode;
    };
};
export declare function isLiquidRequestContext(context: RequestContext): context is LiquidRequestContext;
export declare function isJSONRequestContext(context: RequestContext): context is JSONRequestContext;
