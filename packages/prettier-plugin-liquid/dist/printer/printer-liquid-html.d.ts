import type { Printer as Printer2 } from 'prettier';
import type { Printer as Printer3 } from 'prettier3';
import { LiquidHtmlNode } from '../types';
export declare const printerLiquidHtml2: Printer2<LiquidHtmlNode> & {
    preprocess: any;
} & {
    getVisitorKeys: any;
};
export declare const printerLiquidHtml3: Printer3<LiquidHtmlNode> & {
    preprocess: any;
} & {
    getVisitorKeys: any;
};
