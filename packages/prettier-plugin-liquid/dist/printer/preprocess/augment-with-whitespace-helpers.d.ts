import { HtmlNodeTypes, LiquidNodeTypes } from '@shopify/liquid-html-parser';
import { WithFamily } from '../../types';
import { Augment, AugmentedNode, WithCssProperties, WithParent, WithSiblings } from '../../types';
type RequiredAugmentations = WithParent & WithSiblings & WithFamily & WithCssProperties;
type AugmentedAstNode = AugmentedNode<RequiredAugmentations>;
export declare const augmentWithWhitespaceHelpers: Augment<RequiredAugmentations>;
type ParentNode = Extract<AugmentedAstNode, {
    children?: AugmentedAstNode[];
}>;
type HtmlNode = Extract<AugmentedAstNode, {
    type: (typeof HtmlNodeTypes)[number];
}>;
export declare function isHtmlNode(node: AugmentedAstNode): node is HtmlNode;
type LiquidNode = Extract<AugmentedAstNode, {
    type: (typeof LiquidNodeTypes)[number];
}>;
export declare function isLiquidNode(node: AugmentedAstNode | undefined): node is LiquidNode;
export declare function isParentNode(node: AugmentedAstNode): node is ParentNode;
export declare function isTrimmingOuterRight(node: AugmentedAstNode | undefined): boolean;
export declare function isTrimmingOuterLeft(node: AugmentedAstNode | undefined): boolean;
export declare function isTrimmingInnerLeft(node: AugmentedAstNode | undefined): boolean;
export declare function isTrimmingInnerRight(node: AugmentedAstNode | undefined): boolean;
export {};
