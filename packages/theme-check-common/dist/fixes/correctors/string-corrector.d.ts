import { Fix } from '../../types';
import { BaseCorrector } from './base-corrector';
/**
 * The corrector is a helper that collects Fix objects. At the end we
 * collect those fix objects and apply them on the source code to obtain a
 * "fixed" file.
 *
 * We cannot fix on overlapping ranges.
 *
 * All fix are assumed to be on the file without modifications. The
 * FixApplicator should take care of knowing where to apply fixes as the
 * changes are applied.
 */
export declare class StringCorrector implements BaseCorrector {
    source: string;
    readonly fix: Fix[];
    constructor(source: string);
    /**
     * insert text before the given index
     *
     * @example
     * corrector.insert(
     *   node.position.start,
     *   node.position.start,
     *   'prefix node with this content'
     * )
     *
     * corrector.insert(
     *   node.position.end,
     *   node.position.end,
     *   'suffix node with this content (since position.end is excluded)'
     * )
     */
    insert(index: number, text: string): void;
    /**
     * replace text between start (included) and end (excluded) with text.
     *
     * @example
     * corrector.replace(
     *   node.position.start,
     *   node.position.end,
     *   'ho ho ho',
     * );
     */
    replace(start: number, end: number, text: string): void;
    /**
     * remove text between start (included) and end (excluded)
     *
     * @example
     * corrector.remove(
     *   node.position.start,
     *   node.position.end,
     * )
     */
    remove(start: number, end: number): void;
}
