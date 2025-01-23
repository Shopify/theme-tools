import { SourceCodeType, visit } from '@shopify/theme-check-common';

import { LiquidHtmlNode } from '@shopify/theme-check-common';

import { LiquidDocParamNode } from '@shopify/liquid-html-parser';

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
};

export type LiquidDocParameter = {
  name: string;
  description: string | null;
  type: string | null;
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
        };
      },
    },
  );

  return {
    name: snippetName,
    liquidDoc: {
      parameters: parameters,
    },
  };
}
