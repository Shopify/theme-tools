import { Doc } from 'prettier';
import type { AstPath } from 'prettier';
import type { ParserOptions as ParserOptions3 } from 'prettier3';
import * as AST from '@shopify/liquid-html-parser';
export type CommonKeys<T1, T2> = Extract<keyof T1, keyof T2>;
export type { AstPath };
export type ParserOptions<T = any> = ParserOptions3<T>;
export declare function isLiquidHtmlNode(value: any): value is LiquidHtmlNode;
export type LiquidAstPath = AstPath<LiquidHtmlNode>;
export type LiquidParserOptions = ParserOptions<LiquidHtmlNode> & {
    singleAttributePerLine: boolean;
    singleLineLinkTags: boolean;
    liquidSingleQuote: boolean;
    embeddedSingleQuote: boolean;
    indentSchema: boolean;
    captureWhitespaceSensitivity: 'strict' | 'ignore';
    liquidDocParamDash: boolean;
};
export type LiquidPrinterArgs = {
    leadingSpaceGroupId?: symbol[] | symbol;
    trailingSpaceGroupId?: symbol[] | symbol;
    isLiquidStatement?: boolean;
    truncate?: boolean;
};
export type LiquidPrinter = (path: AstPath<LiquidHtmlNode>, args?: LiquidPrinterArgs) => Doc;
export declare const nonTraversableProperties: Set<string>;
export type Augmented<T, Aug> = {
    [Property in keyof T]: [T[Property]] extends [(infer Item)[] | undefined] ? [Item] extends [AST.LiquidHtmlNode] ? Augmented<Item, Aug>[] : Item[] : T[Property] extends infer P ? P extends AST.LiquidHtmlNode ? Augmented<P, Aug> : P : never;
} & Aug;
export type AllAugmentations = WithParent & WithSiblings & WithFamily & WithCssProperties & WithWhitespaceHelpers;
export type WithParent = {
    parentNode?: ParentNode;
};
export type WithSiblings = {
    prev: LiquidHtmlNode | undefined;
    next: LiquidHtmlNode | undefined;
};
export type WithFamily = {
    firstChild: LiquidHtmlNode | undefined;
    lastChild: LiquidHtmlNode | undefined;
};
export type WithCssProperties = {
    cssDisplay: string;
    cssWhitespace: string;
};
export type WithWhitespaceHelpers = {
    isDanglingWhitespaceSensitive: boolean;
    isWhitespaceSensitive: boolean;
    isLeadingWhitespaceSensitive: boolean;
    isTrailingWhitespaceSensitive: boolean;
    isIndentationSensitive: boolean;
    hasLeadingWhitespace: boolean;
    hasTrailingWhitespace: boolean;
    hasDanglingWhitespace: boolean;
};
export type AugmentedNode<Aug> = Augmented<AST.LiquidHtmlNode, Aug>;
export type Augment<Aug> = <NodeType extends AugmentedNode<Aug>>(options: LiquidParserOptions, node: NodeType, parentNode?: NodeType) => void;
export type LiquidHtmlNode = Augmented<AST.LiquidHtmlNode, AllAugmentations>;
export type DocumentNode = Augmented<AST.DocumentNode, AllAugmentations>;
export type LiquidNode = Augmented<AST.LiquidNode, AllAugmentations>;
export type LiquidStatement = Augmented<AST.LiquidStatement, AllAugmentations>;
export type ParentNode = Augmented<AST.ParentNode, AllAugmentations>;
export type LiquidRawTag = Augmented<AST.LiquidRawTag, AllAugmentations>;
export type LiquidTag = Augmented<AST.LiquidTag, AllAugmentations>;
export type LiquidTagNamed = Augmented<AST.LiquidTagNamed, AllAugmentations>;
export type LiquidBranch = Augmented<AST.LiquidBranch, AllAugmentations>;
export type LiquidBranchNamed = Augmented<AST.LiquidBranchNamed, AllAugmentations>;
export type LiquidVariableOutput = Augmented<AST.LiquidVariableOutput, AllAugmentations>;
export type HtmlNode = Augmented<AST.HtmlNode, AllAugmentations>;
export type HtmlTag = Exclude<HtmlNode, HtmlComment>;
export type HtmlElement = Augmented<AST.HtmlElement, AllAugmentations>;
export type HtmlDanglingMarkerClose = Augmented<AST.HtmlDanglingMarkerClose, AllAugmentations>;
export type HtmlVoidElement = Augmented<AST.HtmlVoidElement, AllAugmentations>;
export type HtmlSelfClosingElement = Augmented<AST.HtmlSelfClosingElement, AllAugmentations>;
export type HtmlRawNode = Augmented<AST.HtmlRawNode, AllAugmentations>;
export type HtmlDoctype = Augmented<AST.HtmlDoctype, AllAugmentations>;
export type HtmlComment = Augmented<AST.HtmlComment, AllAugmentations>;
export type AttributeNode = Augmented<AST.AttributeNode, AllAugmentations>;
export type AttrSingleQuoted = Augmented<AST.AttrSingleQuoted, AllAugmentations>;
export type AttrDoubleQuoted = Augmented<AST.AttrDoubleQuoted, AllAugmentations>;
export type AttrUnquoted = Augmented<AST.AttrUnquoted, AllAugmentations>;
export type AttrEmpty = Augmented<AST.AttrEmpty, AllAugmentations>;
export type LiquidExpression = Augmented<AST.LiquidExpression, AllAugmentations>;
export type TextNode = Augmented<AST.TextNode, AllAugmentations>;
export type RawMarkup = Augmented<AST.RawMarkup, AllAugmentations>;
