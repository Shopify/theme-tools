import { SourceCodeType, visit } from '@shopify/theme-check-common';

import { LiquidHtmlNode } from '@shopify/theme-check-common';

import { LiquidDocExampleNode, LiquidDocParamNode } from '@shopify/liquid-html-parser';

export type GetSnippetDefinitionForURI = (
  uri: string,
  snippetName: string,
) => Promise<SnippetDefinition | undefined>;

export type SnippetDefinition = {
  name: string;
  liquidDoc?: LiquidDocDefinition;
};

type LiquidDocDefinition = {
  parameters?: LiquidDocParameter[];
  examples?: LiquidDocExample[]; //  I don't think we need an array but maybe we'll allow multiple examples
};

export type LiquidDocParameter = {
  name: string;
  description: string | null;
  type: string | null;
  required: boolean;
};

export type LiquidDocExample = {
  content: string;
};

export function getSnippetDefinition(
  snippet: LiquidHtmlNode,
  snippetName: string,
): SnippetDefinition {
  const parameters: LiquidDocParameter[] = visit<SourceCodeType.LiquidHtml, LiquidDocParameter>(
    snippet,
    {
      LiquidDocParamNode(node: LiquidDocParamNode) {
        return {
          name: node.paramName.value,
          description: node.paramDescription?.value ?? null,
          type: node.paramType?.value ?? null,
          required: node.required,
        };
      },
    },
  );

  const examples: LiquidDocExample[] = visit<SourceCodeType.LiquidHtml, LiquidDocExample>(
    snippet,
    {
      LiquidDocExampleNode(node: LiquidDocExampleNode) {
        return {
          content: node.exampleContent.value,
        };
      },
    },
  );

  return {
    name: snippetName,
    liquidDoc: {
      parameters,
      examples,
    },
  };
}
