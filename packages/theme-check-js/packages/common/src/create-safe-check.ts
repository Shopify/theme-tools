import { Check, SourceCodeType } from './types';

const resolve = () => Promise.resolve(undefined);
const handleMissingMethod = {
  get(target: any, prop: string) {
    if (!(prop in target)) return resolve;
    return target[prop];
  },
};

export function createSafeCheck<S extends SourceCodeType>(check: Partial<Check<S>>): Check<S> {
  return new Proxy(check, handleMissingMethod);
}
