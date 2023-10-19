import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  CompletionInfo,
  pickedCompletion,
  Completion,
} from '@codemirror/autocomplete';
import {
  CompletionItem,
  CompletionItemKind,
  CompletionRequest,
  InsertReplaceEdit,
  TextEdit,
} from 'vscode-languageserver-protocol';
import { clientFacet, fileUriFacet } from './client';
import { textDocumentField } from './textDocumentSync';
import { Facet } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { TextDocument } from 'vscode-languageserver-textdocument';

type FirstArgType<F> = F extends (arg: infer A) => any ? A : never;
export type AutocompleteOptions = Partial<FirstArgType<typeof autocompletion>>;

export const liquidHTMLCompletionExtension = (overrides: AutocompleteOptions = {}) =>
  autocompletion({
    activateOnTyping: true,
    override: [completeLiquidHTML],
    maxRenderedOptions: 20,
    ...overrides,
  });

/**
 * An InfoRenderer would be equivalent to the Quick Info window in VS Code. It's the part of the completion
 * window that shows you the docs about the thing that is currently selected.
 *
 * Takes a LSP CompletionItem as argument and returns a DOM node, optional and injected so that we can control
 * how we render the info window from the rendering context.
 */
export type InfoRenderer = (completion: CompletionItem) => CompletionInfo;

export const infoRendererFacet = Facet.define<InfoRenderer | undefined, InfoRenderer | undefined>({
  static: true,
  combine: (values) => values[0] ?? undefined,
});

export async function completeLiquidHTML(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  // TODO does this work well with translations and stuff?
  const word = context.matchBefore(/\w*/);
  if (!word) return null;

  const client = context.state.facet(clientFacet.reader);
  const fileUri = context.state.facet(fileUriFacet.reader);
  const infoRenderer = context.state.facet(infoRendererFacet.reader);
  const textDocument = context.state.field(textDocumentField);

  const results = await client.sendRequest(CompletionRequest.type, {
    textDocument: { uri: fileUri },
    position: textDocument.positionAt(context.pos),
  });

  // No results
  if (results === null) return null;

  // CompletionList not supported
  if (!Array.isArray(results)) return null;

  return {
    from: word.from,
    options: results.map(
      (completionItem): Completion => ({
        label: completionItem.insertText ?? completionItem.label,
        displayLabel: completionItem.label,
        apply: hasApplicableTextEdit(completionItem)
          ? (view, completion) => applyEdit(view, completion, completionItem, textDocument)
          : undefined,
        type: convertLSPKindToCodeMirrorKind(completionItem.kind),
        info: infoRenderer ? (_) => infoRenderer(completionItem) : undefined,
      }),
    ),
  };
}

function hasApplicableTextEdit(
  completionItem: CompletionItem,
): completionItem is CompletionItem & { textEdit: NonNullable<CompletionItem['textEdit']> } {
  return (
    !!completionItem.textEdit &&
    (TextEdit.is(completionItem.textEdit) || InsertReplaceEdit.is(completionItem.textEdit))
  );
}

enum CMCompletionType {
  Class = 'class',
  Constant = 'constant',
  Enum = 'enum',
  Function = 'function',
  Interface = 'interface',
  Keyword = 'keyword',
  Method = 'method',
  Namespace = 'namespace',
  Property = 'property',
  Text = 'text',
  Type = 'type',
  Variable = 'variable',
}

function convertLSPKindToCodeMirrorKind(kind: CompletionItemKind | undefined): CMCompletionType {
  if (!kind) return CMCompletionType.Text;
  switch (kind) {
    case CompletionItemKind.Constructor:
    case CompletionItemKind.Class:
      return CMCompletionType.Class;

    case CompletionItemKind.Constant:
      return CMCompletionType.Constant;

    case CompletionItemKind.Enum:
    case CompletionItemKind.EnumMember:
      return CMCompletionType.Enum;

    case CompletionItemKind.Snippet:
    case CompletionItemKind.Function:
      return CMCompletionType.Function;

    case CompletionItemKind.Interface:
      return CMCompletionType.Interface;

    case CompletionItemKind.Operator:
    case CompletionItemKind.Keyword:
      return CMCompletionType.Keyword;

    case CompletionItemKind.Method:
      return CMCompletionType.Method;

    case CompletionItemKind.File:
    case CompletionItemKind.Folder:
    case CompletionItemKind.Module:
      return CMCompletionType.Namespace;

    case CompletionItemKind.Property:
    case CompletionItemKind.Reference:
    case CompletionItemKind.Field:
      return CMCompletionType.Property;

    case CompletionItemKind.Struct:
    case CompletionItemKind.TypeParameter:
      return CMCompletionType.Type;

    case CompletionItemKind.Event:
    case CompletionItemKind.Value:
    case CompletionItemKind.Variable:
      return CMCompletionType.Variable;

    case CompletionItemKind.Color:
    case CompletionItemKind.Unit:
    case CompletionItemKind.Text:
    default:
      return CMCompletionType.Text;
  }
}

function applyEdit(
  view: EditorView,
  completion: Completion,
  item: CompletionItem & { textEdit: NonNullable<CompletionItem['textEdit']> },
  textDocument: TextDocument,
) {
  const { textEdit } = item;
  let start = 0;
  let end = 0;
  let newText = '';

  if (TextEdit.is(textEdit)) {
    start = textDocument.offsetAt(textEdit.range.start);
    end = textDocument.offsetAt(textEdit.range.end);
    newText = textEdit.newText;
  } else if (InsertReplaceEdit.is(textEdit)) {
    start = textDocument.offsetAt(textEdit.replace.start);
    end = textDocument.offsetAt(textEdit.replace.end);
    newText = textEdit.newText;
  }

  view.dispatch({
    // Tell the completion engine which item we chose
    annotations: [pickedCompletion.of(completion)],
    // Move cursor to after the text
    selection: { anchor: start + newText.length, head: start + newText.length },
    // Apply the text edit
    changes: view.state.changes({
      from: start,
      to: end,
      insert: newText,
    }),
  });
}
