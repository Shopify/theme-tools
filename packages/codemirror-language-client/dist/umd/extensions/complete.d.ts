import { autocompletion, CompletionContext, CompletionResult, CompletionInfo } from '@codemirror/autocomplete';
import { CompletionItem } from 'vscode-languageserver-protocol';
import { Facet } from '@codemirror/state';
type FirstArgType<F> = F extends (arg: infer A) => any ? A : never;
export type AutocompleteOptions = Partial<FirstArgType<typeof autocompletion>>;
export declare const lspComplete: (overrides?: AutocompleteOptions) => import("@codemirror/state").Extension;
/**
 * An InfoRenderer would be equivalent to the Quick Info window in VS Code. It's the part of the completion
 * window that shows you the docs about the thing that is currently selected.
 *
 * Takes a LSP CompletionItem as argument and returns a DOM node, optional and injected so that we can control
 * how we render the info window from the rendering context.
 */
export type InfoRenderer = (completion: CompletionItem) => CompletionInfo;
export declare const infoRendererFacet: Facet<InfoRenderer | undefined, InfoRenderer | undefined>;
export declare function complete(context: CompletionContext): Promise<CompletionResult | null>;
export {};
