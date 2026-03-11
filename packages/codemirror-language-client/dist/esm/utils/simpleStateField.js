import { StateField } from '@codemirror/state';
/** Sometimes you don't want to repeat yourself for a simple state field. */
export function simpleStateField(stateEffect, defaultValue) {
    return StateField.define({
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
//# sourceMappingURL=simpleStateField.js.map