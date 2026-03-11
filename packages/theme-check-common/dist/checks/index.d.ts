import { JSONCheckDefinition, LiquidCheckDefinition } from '../types';
export declare const allChecks: (LiquidCheckDefinition | JSONCheckDefinition)[];
/**
 * The recommended checks is populated by all checks with the following conditions:
 * - meta.docs.recommended: true
 * - Either no meta.targets list exist or if it does exist then Recommended is a target
 */
export declare const recommended: (LiquidCheckDefinition | JSONCheckDefinition)[];
