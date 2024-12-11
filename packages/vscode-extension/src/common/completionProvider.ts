import {
  InlineCompletionContext,
  InlineCompletionItem,
  InlineCompletionItemProvider,
  Position,
  TextDocument,
} from 'vscode';
import { CancellationToken } from 'vscode-languageclient';

export default class LiquidCompletionProvider implements InlineCompletionItemProvider {
  provideInlineCompletionItems(
    document: TextDocument,
    position: Position,
    context: InlineCompletionContext,
    token: CancellationToken,
  ): InlineCompletionItem[] {
    console.error('[SERVER]!!! inline completion >>>');
    console.error(
      '[SERVER]!!! inline completion document -',
      JSON.stringify(document as any, undefined, 2),
    );
    console.error(
      '[SERVER]!!! inline completion position -',
      JSON.stringify(position as any, undefined, 2),
    );
    console.error(
      '[SERVER]!!! inline completion context  -',
      JSON.stringify(context as any, undefined, 2),
    );
    console.error(
      '[SERVER]!!! inline completion token    -',
      JSON.stringify(token as any, undefined, 2),
    );
    console.error('[SERVER]!!! inline completion <<<');

    return [new InlineCompletionItem('Hello from the inline completion provider')];
  }
}
