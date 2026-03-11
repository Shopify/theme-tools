export type Logger = (message: string) => void;
export declare const noop: () => void;
export declare const identity: <T>(x: T) => T;
export declare const tap: <T>(tappingFunction: (x: T) => void) => (x: T) => T;
export { memo, memoize } from '@shopify/theme-check-common';
