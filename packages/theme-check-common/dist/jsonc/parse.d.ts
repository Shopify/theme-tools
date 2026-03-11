import { JSONNode as JSONToASTNode } from './types';
import { ParseError } from 'jsonc-parser';
export declare class JSONCParseErrors extends Error {
    errors: ParseError[];
    constructor(message: string, errors: ParseError[]);
}
/**
 * At some point, we started supporting JSONC. Theme Check 2 was built on top of
 * `json-to-ast` which does not support comments.
 *
 * This little adapter here will take a tree we get from `jsonc-parser` and
 * convert it to the shape of `json-to-ast`.
 *
 * The `json-to-ast` types feel much better to use than the ones from `jsonc-parser`
 * and we don't need to rewrite all our downstream code.
 */
export declare function toJSONNode(source: string): JSONToASTNode;
export declare const location: (start: number, end: number) => {
    start: {
        offset: number;
    };
    end: {
        offset: number;
    };
};
