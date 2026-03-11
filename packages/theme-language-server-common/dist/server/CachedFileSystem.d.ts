import { AbstractFileSystem } from '@shopify/theme-check-common';
export declare class CachedFileSystem implements AbstractFileSystem {
    readFile: Cached<AbstractFileSystem['readFile']>;
    readDirectory: Cached<AbstractFileSystem['readDirectory']>;
    stat: Cached<AbstractFileSystem['stat']>;
    constructor(fs: AbstractFileSystem);
}
interface Cached<Fn extends (uri: string) => Promise<any>, T = ReturnType<Fn>> {
    (uri: string): T;
    invalidate(uri: string): void;
}
export {};
