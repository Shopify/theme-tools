import { SourceCodeType, visit } from '@shopify/theme-check-common';

import { LiquidHtmlNode } from '@shopify/theme-check-common';

import { LiquidDocParamNode } from '@shopify/liquid-html-parser';

export type GetLiquidDocDefinitionsForURI = (
  uri: string,
  snippetName: string,
) => Promise<LiquidDocDefinition>;

export type LiquidDocParameter = {
  name: string;
  description: string | null;
  type: string | null;
};

export type LiquidDocDefinition = {
  name: string;
  parameters?: LiquidDocParameter[];
};

export function getSnippetDefinition(snippet: LiquidHtmlNode, snippetName: string) {
  const liquidDocAnnotations: LiquidDocParameter[] = visit<
    SourceCodeType.LiquidHtml,
    LiquidDocParameter
  >(snippet, {
    LiquidDocParamNode(node: LiquidDocParamNode) {
      return {
        name: node.paramName.value,
        description: node.paramDescription?.value ?? null,
        type: node.paramType?.value ?? null,
      };
    },
  });

  return {
    name: snippetName,
    parameters: liquidDocAnnotations,
  };
}
