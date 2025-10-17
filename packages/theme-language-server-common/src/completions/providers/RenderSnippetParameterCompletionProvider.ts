import {
  LiquidDocParamNode,
  NodeTypes,
  LiquidHtmlNode,
  LiquidTag,
  LiquidVariableLookup,
  RenderMarkup,
  LiquidRawTag,
  LiquidTagSnippet,
} from '@shopify/liquid-html-parser';
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
import { GetDocDefinitionForURI, LiquidDocParameter, visit } from '@shopify/theme-check-common';

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
      parentNode.type !== NodeTypes.RenderMarkup
    ) {
      return [];
    }

    const userInputStr = node.name?.replace(CURSOR, '') || '';
    let liquidDocParams;

    if (parentNode.snippet.type === 'String') {
      const snippetDefinition = await this.getDocDefinitionForURI(
        params.textDocument.uri,
        'snippets',
        parentNode.snippet.value,
      );

      liquidDocParams = snippetDefinition?.liquidDoc?.parameters;
    } else if (parentNode.snippet.type === NodeTypes.VariableLookup) {
      liquidDocParams = getInlineSnippetDocParams(params, parentNode.snippet);
    }

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

function getInlineSnippetDocParams(
  params: LiquidCompletionParams,
  snippet: LiquidVariableLookup,
): LiquidDocParameter[] {
  const ast = params.document.ast;
  if (ast instanceof Error || ast.type !== NodeTypes.Document) return [];

  if (!snippet.name) return [];

  let snippetNode: LiquidTagSnippet | undefined;

  visit(ast, {
    LiquidTag(node: LiquidTag) {
      if (
        node.name === 'snippet' &&
        typeof node.markup !== 'string' &&
        node.markup.type === NodeTypes.VariableLookup &&
        node.markup.name === snippet.name
      ) {
        snippetNode = node as LiquidTagSnippet;
      }
    },
  });

  if (!snippetNode?.children) return [];

  const docNode = snippetNode.children.find(
    (node): node is LiquidRawTag => node.type === NodeTypes.LiquidRawTag && node.name === 'doc',
  );

  if (!docNode) return [];

  const paramNodes = (docNode.body.nodes as LiquidHtmlNode[]).filter(
    (node): node is LiquidDocParamNode => node.type === NodeTypes.LiquidDocParamNode,
  );

  return paramNodes.map(
    (node): LiquidDocParameter => ({
      nodeType: 'param',
      name: node.paramName.value,
      description: node.paramDescription?.value ?? null,
      type: node.paramType?.value ?? null,
      required: node.required,
    }),
  );
}
