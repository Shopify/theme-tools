import { StateEffectType, StateField } from '@codemirror/state';

/** Sometimes you don't want to repeat yourself for a simple state field. */
export function simpleStateField<T>(
  stateEffect: StateEffectType<T>,
  defaultValue: T,
): StateField<T> {
  return StateField.define<T>({
    create: () => defaultValue,
    update(value, tr) {
      let updatedValue = value;

      for (const effect of tr.effects) {
        if (effect.is(stateEffect)) {
          updatedValue = effect.value;
        }
      }

      return updatedValue;
    },
  });
}
