import { LiquidHtmlNode, LiquidRawTag } from '@shopify/liquid-html-parser';
export declare function fileMatch(uri: string, patterns: RegExp[]): boolean;
export declare function isSectionFile(uri: string): boolean;
export declare function isBlockFile(uri: string): boolean;
export declare function isSectionOrBlockFile(uri: string): boolean;
export declare function findSchemaNode(ast: LiquidHtmlNode): LiquidRawTag | undefined;
