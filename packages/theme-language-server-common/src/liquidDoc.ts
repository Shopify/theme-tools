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

interface LiquidDocNode {
  nodeType: 'param' | 'example';
}

export interface LiquidDocParameter extends LiquidDocNode {
  name: string;
  description: string | null;
  type: string | null;
  nodeType: 'param';
}

export interface LiquidDocExample extends LiquidDocNode {
  content: string;
  nodeType: 'example';
}

export function getSnippetDefinition(
  snippet: LiquidHtmlNode,
  snippetName: string,
): SnippetDefinition {
  const nodes: (LiquidDocParameter | LiquidDocExample)[] = visit<
    SourceCodeType.LiquidHtml,
    LiquidDocParameter | LiquidDocExample
  >(snippet, {
    LiquidDocParamNode(node: LiquidDocParamNode) {
      return {
        name: node.paramName.value,
        description: node.paramDescription?.value ?? null,
        type: node.paramType?.value ?? null,
        nodeType: 'param',
      };
    },
    LiquidDocExampleNode(node: LiquidDocExampleNode) {
      return {
        content: node.exampleContent.value,
        nodeType: 'example',
      };
    },
  });

  const parameters = nodes.filter((node): node is LiquidDocParameter => node.nodeType === 'param');
  const examples = nodes.filter((node): node is LiquidDocExample => node.nodeType === 'example');

  return {
    name: snippetName,
    liquidDoc: {
      parameters,
      examples,
    },
  };
}
