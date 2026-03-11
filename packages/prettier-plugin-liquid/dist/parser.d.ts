import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { locEnd, locStart } from './utils';
export declare function parse(text: string): LiquidHtmlNode;
export declare const liquidHtmlAstFormat = "liquid-html-ast";
export declare const liquidHtmlLanguageName = "liquid-html";
export declare const liquidHtmlParser: {
    parse: typeof parse;
    astFormat: string;
    locStart: typeof locStart;
    locEnd: typeof locEnd;
};
export declare const parsers: {
    "liquid-html": {
        parse: typeof parse;
        astFormat: string;
        locStart: typeof locStart;
        locEnd: typeof locEnd;
    };
};
