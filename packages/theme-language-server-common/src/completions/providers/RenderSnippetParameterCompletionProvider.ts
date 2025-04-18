import { NodeTypes } from '@shopify/liquid-html-parser';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  Range,
  TextEdit,
} from 'vscode-languageserver';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { formatLiquidDocParameter, getParameterCompletionTemplate } from '../../utils/liquidDoc';
import { GetDocDefinitionForURI } from '@shopify/theme-check-common';

export type GetSnippetNamesForURI = (uri: string) => Promise<string[]>;

export class RenderSnippetParameterCompletionProvider implements Provider {
  constructor(private readonly getDocDefinitionForURI: GetDocDefinitionForURI) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const parentNode = ancestors.at(-1);

    if (
      !node ||
      !parentNode ||
      node.type !== NodeTypes.VariableLookup ||
      parentNode.type !== NodeTypes.RenderMarkup ||
      parentNode.snippet.type !== 'String'
    ) {
      return [];
    }

    const userInputStr = node.name?.replace(CURSOR, '') || '';

    const snippetDefinition = await this.getDocDefinitionForURI(
      params.textDocument.uri,
      'snippets',
      parentNode.snippet.value,
    );

    const liquidDocParams = snippetDefinition?.liquidDoc?.parameters;

    if (!liquidDocParams) {
      return [];
    }

    let offset = node.name === CURSOR ? 1 : 0;

    let start = params.document.textDocument.positionAt(node.position.start);
    let end = params.document.textDocument.positionAt(node.position.end - offset);

    // We need to find out existing params in the render tag so we don't offer it again for completion
    const existingRenderParams = parentNode.args
      .filter((arg) => arg.type === NodeTypes.NamedArgument)
      .map((arg) => arg.name);

    return liquidDocParams
      .filter((liquidDocParam) => !existingRenderParams.includes(liquidDocParam.name))
      .filter((liquidDocParam) => liquidDocParam.name.startsWith(userInputStr))
      .map((liquidDocParam) => {
        return {
          label: liquidDocParam.name,
          kind: CompletionItemKind.Property,
          documentation: {
            kind: MarkupKind.Markdown,
            value: formatLiquidDocParameter(liquidDocParam, true),
          },
          textEdit: TextEdit.replace(
            Range.create(start, end),
            getParameterCompletionTemplate(liquidDocParam.name, liquidDocParam.type),
          ),
          insertTextFormat: InsertTextFormat.Snippet,
        };
      });
  }
}
