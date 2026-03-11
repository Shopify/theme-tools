import { DocumentOnTypeFormattingParams, TextEdit } from 'vscode-languageserver-protocol';
import { AugmentedSourceCode } from '../../documents';
import { BaseOnTypeFormattingProvider } from '../types';
export declare class BracketsAutoclosingOnTypeFormattingProvider implements BaseOnTypeFormattingProvider {
    /**
     * This very complex piece of code here exists to provide a good autoclosing UX.
     *
     * The story is kind of long so here goes...
     *
     * What we want:
     * 1. Basic autoclosing of {{, {% with the corresponding pair (and spaces)
     *   - user types: {{
     *   - user sees: {{ | }} (with cursor position at |)
     * 2. Autoclosing of {{- with -}}, {%- with -%}
     *   - user types: {{-
     *   - user sees: {{- | -}} (with cursor at |)
     * 3. User adds whitespace stripping on one side of the braces of an existing tag
     *   - user types: - at | in `{{| drop }}`
     *   - user sees: {{- drop }}
     *
     * Why we can't do it with autoclosingPairs:
     *   - VS Code's settings accepts autoclosingPairs and autocloseBefore
     *     - autoclosingPairs is a set of pairs that should be autoclosed (e.g. ['{%', '%}'])
     *     - autocloseBefore is a character set of 'allowed next characters' that would cause a closing pair
     *   - If we put a space (' ') the autoclosingPairs set, then (3) from above becomes funky:
     *     - assume autoclosingPairs = {|}, {{|}}, {{ | }}
     *     - user types: a space at | in `{{| drop }}`
     *     - user sees: {{   }}drop }}
     *   - This happens because the space is an autocloseBefore character, it sees a space after the cursor
     *     so it closes '{{ ' with ' }}' at the cursor position, resulting in '{{  }}drop }}'
     *   - Something similar happens if we include the `-` in the autoclosing pairs
     *   - This is annoying!
     *
     * So our solution is the following:
     * 1. We change the pairs to include the closing space (this way our cursor remains where we want it to be)
     *    - {{| }}
     *    - {%| %}
     * 2. We add this OnTypeFormattingProvider that does the following "fixes":
     *    - {{| }}   into {{ | }}
     *    - {{ -| }} into {{- | -}}
     *    - {%| %}   into {% | %}
     *    - {% -| %} into {%- | -%}
     *
     * This lets us avoid the unnecessary close and accomplish 1, 2 and 3 :)
     *
     * Fallback for editor.onTypeFormatting: false is to let the user type the `-` on both sides manually
     */
    onTypeFormatting(document: AugmentedSourceCode, params: DocumentOnTypeFormattingParams): TextEdit[] | null;
}
