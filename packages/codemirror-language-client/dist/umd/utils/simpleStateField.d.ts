import { StateEffectType, StateField } from '@codemirror/state';
/** Sometimes you don't want to repeat yourself for a simple state field. */
export declare function simpleStateField<T>(stateEffect: StateEffectType<T>, defaultValue: T): StateField<T>;
