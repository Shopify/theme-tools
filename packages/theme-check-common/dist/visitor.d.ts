import { AST, LiquidHtmlNode, NodeOfType, SourceCodeType, NodeTypes, JSONNode } from './types';
export type VisitorMethod<S extends SourceCodeType, T, R> = (node: NodeOfType<S, T>, ancestors: AST[S][]) => R | R[] | undefined;
export type Visitor<S extends SourceCodeType, R> = {
    [T in NodeTypes[S]]?: VisitorMethod<S, T, R>;
};
export type ExecuteFunction<S extends SourceCodeType> = (node: AST[S], lineage: AST[S][]) => void;
/**
 * @example
 *
 * const links = visit<'LiquidHTML', DocumentLink>(liquidAST, {
 *   'LiquidTag': (node, ancestors) => {
 *     if (node.name === 'render' || node.name === 'include') {
 *       return DocumentLink.create(...);
 *     }
 *   },
 * })
 *
 * Note: this is the ChatGPT-rewritten version of the recursive method.
 * If you want to refactor it, just ask it to do it for you :P
 */
export declare function visit<S extends SourceCodeType, R>(node: AST[S], visitor: Visitor<S, R>): R[];
export declare function forEachChildNodes<S extends SourceCodeType>(node: AST[S], lineage: AST[S][], execute: ExecuteFunction<S>): void;
export declare function findCurrentNode(ast: LiquidHtmlNode, cursorPosition: number): [node: LiquidHtmlNode, ancestors: LiquidHtmlNode[]];
export declare function findJSONNode(ast: JSONNode, cursorPosition: number): [node: JSONNode, ancestors: JSONNode[]];
