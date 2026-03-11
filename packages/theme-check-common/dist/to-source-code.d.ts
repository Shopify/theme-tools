import { JSONNode, JSONSourceCode, LiquidSourceCode } from './types';
export declare function toLiquidHTMLAST(source: string): Error | import("@shopify/liquid-html-parser").DocumentNode;
export declare function toJSONAST(source: string): JSONNode | Error;
export declare function toSourceCode(uri: string, source: string, version?: number): LiquidSourceCode | JSONSourceCode;
