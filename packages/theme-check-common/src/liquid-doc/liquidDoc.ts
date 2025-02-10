import { SourceCodeType } from '../types';
import { visit } from '../visitor';
import { LiquidHtmlNode } from '../types';
import {
  LiquidDocExampleNode,
  LiquidDocParamNode,
  LiquidRawTag,
} from '@shopify/liquid-html-parser';

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
  examples?: LiquidDocExample[];
};

interface LiquidDocNode {
  nodeType: 'param' | 'example';
}

export interface LiquidDocParameter extends LiquidDocNode {
  name: string;
  description: string | null;
  type: string | null;
  required: boolean;
}

export interface LiquidDocExample extends LiquidDocNode {
  content: string;
  nodeType: 'example';
}

export function getSnippetDefinition(
  snippet: LiquidHtmlNode,
  snippetName: string,
): SnippetDefinition {
  let hasDocTag = false;
  const nodes: (LiquidDocParameter | LiquidDocExample)[] = visit<
    SourceCodeType.LiquidHtml,
    LiquidDocParameter | LiquidDocExample
  >(snippet, {
    LiquidRawTag(node) {
      if (node.name === 'doc') hasDocTag = true;
      return undefined;
    },
    LiquidDocParamNode(node: LiquidDocParamNode) {
      return {
        name: node.paramName.value,
        description: node.paramDescription?.value ?? null,
        type: node.paramType?.value ?? null,
        required: node.required,
        nodeType: 'param',
      };
    },
    LiquidDocExampleNode(node: LiquidDocExampleNode) {
      return {
        content: node.content.value,
        nodeType: 'example',
      };
    },
  });

  const parameters = nodes.filter((node): node is LiquidDocParameter => node.nodeType === 'param');
  const examples = nodes.filter((node): node is LiquidDocExample => node.nodeType === 'example');

  return {
    name: snippetName,
    liquidDoc: hasDocTag ? { parameters, examples } : undefined,
  };
}
