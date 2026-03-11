import { JSONNode } from './types';
export declare function parseJSON(source: string): any | Error;
export declare function parseJSON(source: string, defaultValue: any): any;
export declare function parseJSON(source: string, defaultValue: any, isStrict: boolean): any;
/**
 * Given a known path to a property and an ast, returns the AST node at that path.
 *
 * @example
 * const nameNode = nodeAtPath(ast, ['name'])! as LiteralNode;
 * const blocksNode = nodeAtPath(ast, ['blocks'])! as ArrayNode;
 * const someDeepNode = nodeAtPath(ast, ['blocks', 0, 'settings', 'someDeepKey'])! as LiteralNode;
 */
export declare function nodeAtPath(node: JSONNode, path: (string | number)[]): JSONNode | undefined;
/** Given a JSONNode, returns the start offset of the node in the source string. */
export declare function getLocStart(node: JSONNode): number;
/** Given a JSONNode, returns the end offset of the node in the source string. */
export declare function getLocEnd(node: JSONNode): number;
