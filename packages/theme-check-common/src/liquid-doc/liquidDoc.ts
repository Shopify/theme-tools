import { SourceCodeType } from '../types';
import { visit } from '../visitor';
import { LiquidHtmlNode } from '../types';
import {
  LiquidDocExampleNode,
  LiquidDocParamNode,
  LiquidDocDescriptionNode,
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
  description?: LiquidDocDescription;
};

interface LiquidDocNode {
  nodeType: 'param' | 'example' | 'description';
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

export interface LiquidDocDescription extends LiquidDocNode {
  content: string;
  nodeType: 'description';
}

export function getSnippetDefinition(
  snippet: LiquidHtmlNode,
  snippetName: string,
): SnippetDefinition {
  let hasDocTag = false;
  const nodes: (LiquidDocParameter | LiquidDocExample | LiquidDocDescription)[] = visit<
    SourceCodeType.LiquidHtml,
    LiquidDocParameter | LiquidDocExample | LiquidDocDescription
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
    LiquidDocDescriptionNode(node: LiquidDocDescriptionNode) {
      return {
        content: node.content.value,
        nodeType: 'description',
      };
    },
  });
  const { parameters, examples, description } = nodes.reduce(
    (acc, node) => {
      if (node.nodeType === 'param') {
        acc.parameters.push(node as LiquidDocParameter);
      } else if (node.nodeType === 'example') {
        acc.examples.push(node as LiquidDocExample);
      } else if (node.nodeType === 'description' && !acc.description) {
        acc.description = node as LiquidDocDescription;
      }
      return acc;
    },
    {
      parameters: [] as LiquidDocParameter[],
      examples: [] as LiquidDocExample[],
      description: undefined as LiquidDocDescription | undefined,
    },
  );

  if (!hasDocTag) return { name: snippetName };

  return {
    name: snippetName,
    liquidDoc: {
      ...(parameters.length && { parameters }),
      ...(examples.length && { examples }),
      ...(description && { description }),
    },
  };
}
