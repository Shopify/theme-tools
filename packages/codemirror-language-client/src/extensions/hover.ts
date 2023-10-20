import { Hover, HoverRequest } from 'vscode-languageserver-protocol';
import { clientFacet, fileUriFacet } from './client';
import { textDocumentField } from './textDocumentSync';
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

export const hoverRendererFacet = Facet.define<
  HoverRenderer | undefined,
  HoverRenderer | undefined
>({
  static: true,
  combine: (values) => values[0] ?? undefined,
});

export const lspHover = (overrides: HoverOptions = {}) =>
  hoverTooltip(hover, {
    ...overrides,
  });

export async function hover(view: EditorView, pos: number, _side: -1 | 1): Promise<Tooltip | null> {
  const client = view.state.facet(clientFacet.reader);
  const fileUri = view.state.facet(fileUriFacet.reader);
  const hoverRenderer = view.state.facet(hoverRendererFacet.reader);
  const textDocument = view.state.field(textDocumentField);

  if (!hoverRenderer) return null;

  const result = await client.sendRequest(HoverRequest.type, {
    textDocument: { uri: fileUri },
    position: textDocument.positionAt(pos),
  });

  // No results
  if (result === null) return null;

  let { from, to, text } = view.state.doc.lineAt(pos);
  let start = pos;
  let end = pos;
  if (result.range) {
    start = textDocument.offsetAt(result.range.start);
    end = textDocument.offsetAt(result.range.end);
  } else {
    // basic "current word" algo
    while (start > from && /\w/.test(text[start - from - 1])) start--;
    while (end < to && /\w/.test(text[end - from])) end++;
  }

  return {
    pos: start,
    end: end,
    above: true,
    create: (view) => hoverRenderer(view, result),
    arrow: false,
  };
}
