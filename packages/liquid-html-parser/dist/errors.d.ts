import { MatchResult } from 'ohm-js';
import { NodeTypes, Position } from './types';
interface LineColPosition {
    line: number;
    column: number;
}
export declare class LiquidHTMLCSTParsingError extends SyntaxError {
    loc?: {
        start: LineColPosition;
        end: LineColPosition;
    };
    constructor(ohm: MatchResult);
}
export type UnclosedNode = {
    type: NodeTypes;
    name: string;
    blockStartPosition: Position;
};
export declare class LiquidHTMLASTParsingError extends SyntaxError {
    loc?: {
        start: LineColPosition;
        end: LineColPosition;
    };
    unclosed: UnclosedNode | null;
    constructor(message: string, source: string, startIndex: number, endIndex: number, unclosed?: UnclosedNode);
}
export {};
