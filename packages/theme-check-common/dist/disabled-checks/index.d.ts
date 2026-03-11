import { LiquidHtmlNode, Position } from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, Offense } from '../types';
export declare function createDisabledChecksModule(): {
    DisabledChecksVisitor: LiquidCheckDefinition;
    isDisabled: (offense: Offense) => boolean;
};
export declare function findNextLinePosition(ast: LiquidHtmlNode, node: LiquidHtmlNode): Position | undefined;
