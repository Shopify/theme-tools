export declare const INVALID_SYNTAX_MESSAGE = "Syntax is not supported";
export declare function getValuesInMarkup(markup: string): {
    value: string;
    index: number;
}[];
export declare function getFragmentsInMarkup(markup: string): {
    value: string;
    index: number;
}[];
export declare function getRangeMatch(markup: string): RegExpMatchArray | null;
export declare function doesFragmentContainUnsupportedParentheses(fragment: string): boolean;
export declare function fragmentKeyValuePair(fragment: string): {
    key: string;
    value: string;
} | undefined;
