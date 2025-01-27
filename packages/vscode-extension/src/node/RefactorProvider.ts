import { CodeAction, CodeActionKind, CodeActionProvider, Range, TextDocument } from 'vscode';

export class RefactorProvider implements CodeActionProvider {
  public static readonly providedCodeActionKinds = [CodeActionKind.RefactorRewrite];

  public provideCodeActions(document: TextDocument, range: Range) {
    const title = 'Refactor using Shopify Magic';
    const kind = CodeActionKind.RefactorRewrite;
    const refactorAction = new CodeAction(title, kind);

    refactorAction.command = {
      command: 'shopifyLiquid.shopifyMagic',
      title,
      arguments: [document, range],
    };

    return [refactorAction];
  }
}
