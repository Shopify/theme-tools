import type { Printer as Printer2 } from 'prettier';
import type { Printer as Printer3 } from 'prettier3';
import { RawMarkupKinds } from '@shopify/liquid-html-parser';
import { LiquidHtmlNode } from '../types';
export declare const ParserMap: {
    [key in RawMarkupKinds]: string | null;
};
export declare const embed2: Printer2<LiquidHtmlNode>['embed'];
export declare const embed3: Printer3<LiquidHtmlNode>['embed'];
