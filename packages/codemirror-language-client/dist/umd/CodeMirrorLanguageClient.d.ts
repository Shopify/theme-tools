import { Extension } from '@codemirror/state';
import { Dependencies, LanguageClient } from './LanguageClient';
import { AutocompleteOptions, DiagnosticRenderer, HoverOptions, HoverRenderer, InfoRenderer, LinterOptions } from './extensions';
export { Dependencies };
export interface FeatureFlags {
    shouldComplete: boolean;
    shouldLint: boolean;
    shouldHover: boolean;
}
export type ClientDependencies = Partial<Dependencies>;
export interface CodeMirrorDependencies {
    /**
     * The infoRenderer is a function that returns a DOM node that contains the documentation
     * for a completion item. Presumably does markdown conversions to DOM nodes.
     *
     * A function that takes a completion object and returns a DOM node.
     */
    infoRenderer?: InfoRenderer;
    /**
     * Say you wanted to change the settings of the `autocomplete` extension,
     * you'd do it with that.
     */
    autocompleteOptions?: AutocompleteOptions;
    /**
     * Say you wanted to change the settings of the `linter` extension,
     * you'd do it with that.
     */
    linterOptions?: LinterOptions;
    /**
     * The diagnosticRenderer is a function that returns a DOM node that
     * contains the content of a diagnostic. It overrides the default
     * rendering logic for diagnostics.
     */
    diagnosticRenderer?: DiagnosticRenderer;
    /**
     * The hoverRenderer is a function that returns a DOM node that contains the documentation
     * for the item under the cursor. The documentation is provided by the Language Server.
     */
    hoverRenderer?: HoverRenderer;
    /**
     * Say you wanted to change the settings of the `hoverTooltip` extension,
     * you'd do it with that.
     */
    hoverOptions?: HoverOptions;
}
export declare class CodeMirrorLanguageClient {
    private readonly worker;
    readonly client: LanguageClient;
    private readonly infoRenderer;
    private readonly autocompleteExtension;
    private readonly diagnosticRenderer;
    private readonly linterExtension;
    private readonly hoverRenderer;
    private readonly hoverExtension;
    private readonly documentHighlightsExtension;
    constructor(worker: Worker, { log, initializationOptions }?: ClientDependencies, { infoRenderer, autocompleteOptions, diagnosticRenderer, linterOptions, hoverRenderer, hoverOptions, }?: CodeMirrorDependencies);
    start(): Promise<void>;
    stop(): Promise<void>;
    extension(fileUri: string, { shouldLint, shouldComplete, shouldHover }?: FeatureFlags): Extension[];
}
