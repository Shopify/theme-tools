import { Grammar } from 'ohm-js';
export declare const liquidHtmlGrammars: import("ohm-js").Namespace;
export declare const TextNodeGrammar: Grammar;
export declare const LiquidDocGrammar: Grammar;
export interface LiquidGrammars {
    Liquid: Grammar;
    LiquidHTML: Grammar;
    LiquidStatement: Grammar;
}
export declare const strictGrammars: LiquidGrammars;
export declare const tolerantGrammars: LiquidGrammars;
export declare const placeholderGrammars: LiquidGrammars;
export declare const BLOCKS: string[];
export declare const RAW_TAGS: string[];
export declare const VOID_ELEMENTS: string[];
export declare const TAGS_WITHOUT_MARKUP: string[];
