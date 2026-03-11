import { Hover } from 'vscode-languageserver-protocol';
import { Facet } from '@codemirror/state';
import { EditorView, Tooltip, TooltipView, hoverTooltip } from '@codemirror/view';
type SecondArgType<F> = F extends (_: any, arg: infer A) => any ? A : never;
export type HoverOptions = Partial<SecondArgType<typeof hoverTooltip>>;
/**
 * A HoverRenderer would be equivalent to the Hover window in VS Code. It
 * shows the documentation for the symbol under the cursor.
 *
 * Takes a LSP Hover as argument and must return a TooltipView (type {} and autocomplete for required params).
 */
export type HoverRenderer = (view: EditorView, hover: Hover) => TooltipView;
export declare const hoverRendererFacet: Facet<HoverRenderer | undefined, HoverRenderer | undefined>;
export declare const lspHover: (overrides?: HoverOptions) => import("@codemirror/state").Extension;
export declare function hover(view: EditorView, pos: number, _side: -1 | 1): Promise<Tooltip | null>;
export {};
