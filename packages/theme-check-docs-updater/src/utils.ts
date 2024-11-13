export type Logger = (message: string) => void;
export const noop = () => {};

export const identity = <T>(x: T): T => x;
export const tap = <T>(tappingFunction: (x: T) => void) => {
  return (x: T) => {
    tappingFunction(x);
    return x;
  };
};

export { memo, memoize } from '@shopify/theme-check-common';
