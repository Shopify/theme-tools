import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  HoverParams,
} from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';

export function getRequestParams(
  documentManager: DocumentManager,
  relativePath: string,
  source: string,
): HoverParams & CompletionParams {
  const uri = `file:///root/${relativePath}`;
  const sourceWithoutCursor = source.replace('█', '');
  documentManager.open(uri, sourceWithoutCursor, 1);
  const doc = documentManager.get(uri)!.textDocument;
  const position = doc.positionAt(source.indexOf('█'));

  return {
    textDocument: { uri: uri },
    position: position,
  };
}

export function isCompletionList(
  completions: null | CompletionList | CompletionItem[],
): completions is CompletionList {
  return completions !== null && !Array.isArray(completions);
}
