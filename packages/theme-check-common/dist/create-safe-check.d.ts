import { Check, SourceCodeType } from './types';
export declare function createSafeCheck<S extends SourceCodeType>(check: Partial<Check<S>>): Check<S>;
