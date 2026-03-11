import { Offense, Theme, FixApplicator } from '@shopify/theme-check-common';
export declare const saveToDiskFixApplicator: FixApplicator;
/**
 * Apply and save to disk the safe fixes for a set of offenses on a theme.
 */
export declare function autofix(sourceCodes: Theme, offenses: Offense[]): Promise<void>;
