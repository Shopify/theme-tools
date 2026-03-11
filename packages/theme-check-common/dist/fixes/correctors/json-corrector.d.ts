import { Fix } from '../../types';
import { BaseCorrector } from './base-corrector';
/**
 * The JSONCorrector collects patches and then creates a Fix object
 * that represents the application of all the collected patches on the
 * source document.
 *
 * Fixes are assumed to not be overlapping.
 */
export declare class JSONCorrector implements BaseCorrector {
    source: string;
    private readonly patches;
    constructor(source: string);
    /**
     * corrector.fix is the data representation of all the changes to source.
     */
    get fix(): Fix;
    /**
     * Add value at dot delited JSON path
     *
     * @example
     * corrector.add('missing.key', 'TO DO')
     */
    add(path: string, value: any): void;
    /**
     * Replace a value at dot delited JSON path.
     *
     * @example
     * corrector.replace('missing.key', 'TO DO')
     */
    replace(path: string, value: any): void;
    /**
     * Remove key from JSON object
     *
     * @example
     * corrector.remove('unneeded.key')
     */
    remove(path: string): void;
}
