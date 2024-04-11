import { Compartment, Facet, StateEffect, StateField, Transaction } from '@codemirror/state';
import { EditorView, Panel, keymap } from '@codemirror/view';
import { vim } from '@replit/codemirror-vim';

const vimStateEffect = StateEffect.define<boolean>();
// create a statefield that's a boolean
const vimStateField = StateField.define<boolean>({
  create: () => {
    return false;
  },
  update: (value: boolean, transaction: Transaction) => {
    let updatedValue = value;
    for (const effect of transaction.effects) {
      if (effect.is(vimStateEffect)) {
        updatedValue = effect.value;
      }
    }
    return updatedValue;
  },
});

export function vimFacet() {
  const vimEnabledFacet = Facet.define<boolean, boolean>({
    combine: (values) => values.some((x) => x),
  });
  let vimCompartment = new Compartment();

  function toggle(view: EditorView) {
    const vimEnabled = view.state.facet(vimEnabledFacet);
    let vimFacetExtension = vimEnabledFacet.of(!vimEnabled);
    view.dispatch({
      effects: [vimCompartment.reconfigure([vimEnabled ? [] : vim(), vimFacetExtension])],
    });
    return true;
  }

  return [vimCompartment.of([]), keymap.of([{ key: 'Mod-Alt-v', run: toggle }])];
}

export function vimConfig() {
  let vimCompartment = new Compartment();

  const vimStateFieldKeyBind = keymap.of([
    {
      key: 'Mod-Alt-v',
      run: function toggle(view: EditorView) {
        const vimEnabled = view.state.field(vimStateField);
        view.dispatch({
          effects: [
            vimCompartment.reconfigure([vimEnabled ? [] : vim()]),
            vimStateEffect.of(!vimEnabled),
          ],
        });
        return true;
      },
    },
  ]);

  return [vimCompartment.of([]), vimStateField, vimStateFieldKeyBind];
}

export function vimStatePanel(view: EditorView): Panel {
  let dom = document.createElement('div');
  const vimEnabled = view.state.field(vimStateField);
  dom.textContent = `Vim Mode: ${vimEnabled}`;
  return {
    top: false,
    dom,
    update(update) {
      const value = update.state.field(vimStateField);
      dom.textContent = `Vim Mode: ${value}`;
    },
  };
}
