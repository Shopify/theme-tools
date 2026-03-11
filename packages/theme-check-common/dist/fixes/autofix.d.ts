import { FixApplicator, Offense, Theme } from '../types';
/**
 * Takes a theme, list of offenses and a fixApplicator and runs all the
 * safe ones on the theme.
 *
 * Note that offense.fix is assumed to be safe, unlike offense.suggest
 * options.
 */
export declare function autofix(sourceCodes: Theme, offenses: Offense[], applyFixes: FixApplicator): Promise<void>;
