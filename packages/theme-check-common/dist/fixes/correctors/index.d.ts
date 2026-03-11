import { Corrector, SourceCodeType } from '../../types';
import { JSONCorrector } from './json-corrector';
import { StringCorrector } from './string-corrector';
export { JSONCorrector, StringCorrector };
export declare function createCorrector<S extends SourceCodeType>(sourceCodeType: S, source: string): Corrector<S>;
