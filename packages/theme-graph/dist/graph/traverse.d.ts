import { AugmentedDependencies, Range, Reference, ThemeGraph, ThemeModule, Void } from '../types';
export declare function traverseModule(module: ThemeModule, themeGraph: ThemeGraph, deps: AugmentedDependencies): Promise<Void>;
/**
 * The bind method is the method that links two modules together.
 *
 * It adds the dependency to the source module's dependencies and the target module's references.
 *
 * This function mutates the source and target modules.
 */
export declare function bind(source: ThemeModule, target: ThemeModule, { sourceRange, targetRange, type, }?: {
    sourceRange?: Range;
    targetRange?: Range;
    type?: Reference['type'];
}): void;
