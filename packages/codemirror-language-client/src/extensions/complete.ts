import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  CompletionInfo,
  pickedCompletion,
  Completion,
  snippet,
} from '@codemirror/autocomplete';
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionRequest,
  InsertTextFormat,
  InsertReplaceEdit,
  TextEdit,
  CompletionTriggerKind,
  CompletionContext as LSPCompletionContext,
} from 'vscode-languageserver-protocol';
import { clientFacet, fileUriFacet, serverCapabilitiesFacet } from './client';
import { textDocumentField } from './textDocumentSync';
import { Facet } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { translateSnippet } from './snippet';

type FirstArgType<F> = F extends (arg: infer A) => any ? A : never;
export type AutocompleteOptions = Partial<FirstArgType<typeof autocompletion>>;

export const lspComplete = (overrides: AutocompleteOptions = {}) =>
  autocompletion({
    activateOnTyping: true,
    override: [complete],
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

export async function complete(context: CompletionContext): Promise<CompletionResult | null> {
  const word = context.matchBefore(/\w+/);
  const serverCapabilities = context.state.facet(serverCapabilitiesFacet.reader);
  const triggerCharacters = serverCapabilities.completionProvider?.triggerCharacters ?? [];
  const previousChar = context.state.doc.sliceString(context.pos - 1, context.pos);
  const isTriggerCharacter = triggerCharacters.includes(previousChar);
  const canComplete = isTriggerCharacter || word || context.pos === 0;
  if (!canComplete) return null;

  const client = context.state.facet(clientFacet.reader);
  const fileUri = context.state.facet(fileUriFacet.reader);
  const infoRenderer = context.state.facet(infoRendererFacet.reader);
  const textDocument = context.state.field(textDocumentField);

  const lspContext: LSPCompletionContext = isTriggerCharacter
    ? { triggerKind: CompletionTriggerKind.TriggerCharacter, triggerCharacter: previousChar }
    : { triggerKind: CompletionTriggerKind.Invoked };

  const results = await client.sendRequest(CompletionRequest.type, {
    textDocument: { uri: fileUri },
    position: textDocument.positionAt(context.pos),
    context: lspContext,
  });

  // No results
  if (results === null || (Array.isArray(results) && results.length === 0)) return null;

  return {
    from: word?.from ?? context.pos,
    options: items(results).map(toCodeMirrorCompletion(infoRenderer, textDocument)),
  };
}

const toCodeMirrorCompletion =
  (infoRenderer: InfoRenderer | undefined, textDocument: TextDocument) =>
  (completionItem: CompletionItem): Completion => {
    switch (completionItem.insertTextFormat) {
      case InsertTextFormat.Snippet:
        return {
          label: completionItem.insertText ?? completionItem.label,
          displayLabel: completionItem.label,
          apply: applySnippet(completionItem as SnippetCompletionItem, textDocument),
          type: convertLSPKindToCodeMirrorKind(completionItem.kind),
          info: infoRenderer ? (_) => infoRenderer(completionItem) : undefined,
        };

      case InsertTextFormat.PlainText:
      default: {
        return {
          label: completionItem.insertText ?? completionItem.label,
          displayLabel: completionItem.label,
          apply: hasApplicableTextEdit(completionItem)
            ? (view, completion) => applyEdit(view, completion, completionItem, textDocument)
            : undefined,
          type: convertLSPKindToCodeMirrorKind(completionItem.kind),
          info: infoRenderer ? (_) => infoRenderer(completionItem) : undefined,
        };
      }
    }
  };

function hasApplicableTextEdit(
  completionItem: CompletionItem,
): completionItem is CompletionItem & { textEdit: NonNullable<CompletionItem['textEdit']> } {
  return (
    !!completionItem.textEdit &&
    (TextEdit.is(completionItem.textEdit) || InsertReplaceEdit.is(completionItem.textEdit))
  );
}

type SnippetCompletionItem = Omit<CompletionItem, 'insertTextFormat'> & {
  insertTextFormat: typeof InsertTextFormat.Snippet;
};

const applySnippet = (item: SnippetCompletionItem, textDocument: TextDocument) => {
  const { textEdit } = item;
  let from: null | number = null;
  let to: null | number = null;
  let newText = '';

  if (TextEdit.is(textEdit)) {
    from = textDocument.offsetAt(textEdit.range.start);
    to = textDocument.offsetAt(textEdit.range.end);
    newText = textEdit.newText;
  } else if (textEdit && InsertReplaceEdit.is(textEdit)) {
    from = textDocument.offsetAt(textEdit.replace.start);
    to = textDocument.offsetAt(textEdit.replace.end);
    newText = textEdit.newText;
  } else if (item.insertText) {
    newText = item.insertText;
  } else {
    newText = item.label;
  }

  const template = translateSnippet(newText);

  // Because we might replace text with textEdit, we can't use snippet as is.
  // we'll need to infer the from/to from the textEdit.
  const apply = snippet(template);
  return (view: EditorView, completion: Completion, defaultFrom: number, defaultTo: number) => {
    apply(view, completion, from ?? defaultFrom, to ?? defaultTo);
  };
};

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

function isCompletionList(results: CompletionList | CompletionItem[]): results is CompletionList {
  return (results as CompletionList).isIncomplete !== undefined;
}

function items(results: CompletionList | CompletionItem[]): CompletionItem[] {
  if (isCompletionList(results)) {
    return (results as CompletionList).items.map((item) => ({
      ...results.itemDefaults,
      ...item,
    }));
  }
  return results;
}
