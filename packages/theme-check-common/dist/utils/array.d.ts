export declare function first<T>(arr: T[]): T | undefined;
export declare function last<T>(arr: T[], offset?: number): T | undefined;
export declare function findLast<T, NT extends T>(array: T[], pred: (n: T) => n is NT): NT | undefined;
export declare function findLastIndex<T>(array: T[], pred: (n: T) => boolean): number;
export declare function findLastAndIndex<T, NT extends T>(array: T[], pred: (n: T) => n is NT): [NT, number] | [undefined, -1];
