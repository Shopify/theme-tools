import { Position, NodeTypes, HtmlElement, AttrEmpty, AttrSingleQuoted, AttrDoubleQuoted, AttrUnquoted, LiquidHtmlNode, LiquidBranch, LiquidTagFor, LiquidTagTablerow, LiquidTag } from '@shopify/liquid-html-parser';
import { LiquidHtmlNodeOfType as NodeOfType } from '../types';
type ElementType<T> = T extends (infer E)[] ? E : never;
export type ValuedHtmlAttribute = AttrSingleQuoted | AttrDoubleQuoted | AttrUnquoted;
export declare function isNodeOfType<T extends NodeTypes>(type: T, node?: LiquidHtmlNode): node is NodeOfType<T>;
export declare function isLiquidBranch(node: LiquidHtmlNode): node is LiquidBranch;
export declare function isHtmlTag<T>(node: HtmlElement, name: T): node is HtmlElement & {
    name: [{
        name: T;
    }];
    blockEndPosition: Position;
};
export declare function isAttr(attr: ValuedHtmlAttribute | AttrEmpty, name: string): boolean;
export declare function isHtmlAttribute(attr: ElementType<HtmlElement['attributes']>): attr is ValuedHtmlAttribute | AttrEmpty;
export declare function isValuedHtmlAttribute(attr: ElementType<HtmlElement['attributes']>): attr is ValuedHtmlAttribute;
export declare function valueIncludes(attr: ValuedHtmlAttribute, word: string): boolean;
export declare function hasAttributeValueOf(attr: ValuedHtmlAttribute, value: string): boolean;
export declare function isLiquidString(node: LiquidHtmlNode): node is NodeOfType<NodeTypes.String>;
export declare function isLoopScopedVariable(variableName: string, ancestors: LiquidHtmlNode[]): boolean;
export declare function isLoopLiquidTag(tag: LiquidTag): tag is LiquidTagFor | LiquidTagTablerow;
export declare function isWithinRawTagThatDoesNotParseItsContents(ancestors: LiquidHtmlNode[]): boolean;
export {};
