import { Doc, doc } from 'prettier';
import { LiquidAstPath, LiquidHtmlNode } from '../../types';
export * from './array';
export * from './string';
export * from './node';
export declare function getSource(path: LiquidAstPath): string;
export declare function isDeeplyNested(node: Extract<LiquidHtmlNode, {
    children?: LiquidHtmlNode[];
}>): boolean;
export declare function getWhitespaceTrim(currWhitespaceTrim: string, needsWhitespaceStrippingOnBreak: boolean | undefined, groupIds?: symbol | symbol[]): Doc;
export declare const FORCE_FLAT_GROUP_ID: unique symbol;
export declare const FORCE_BREAK_GROUP_ID: unique symbol;
export declare function ifBreakChain(breaksContent: Doc, flatContent: Doc, groupIds: (symbol | undefined)[]): doc.builders.Doc;
export declare function isNonEmptyArray(object: any): object is any[];
