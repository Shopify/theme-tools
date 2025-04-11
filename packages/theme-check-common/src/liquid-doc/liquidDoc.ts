import { SourceCodeType } from '../types';
import { visit } from '../visitor';
import { LiquidHtmlNode } from '../types';
import {
  LiquidDocExampleNode,
  LiquidDocParamNode,
  LiquidDocDescriptionNode,
} from '@shopify/liquid-html-parser';

export type DocSupportedType = 'blocks' | 'snippets';

export type GetDocDefinitionForURI = (
  uri: string,
  type: DocSupportedType,
  name: string,
) => Promise<DocDefinition | undefined>;

export type DocDefinition = {
  name: string;
  type: DocSupportedType,
  liquidDoc?: DocContent;
};

type DocContent = {
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

export function getDocDefinition(
  node: LiquidHtmlNode,
  type: DocSupportedType,
  name: string,
): DocDefinition {
  let hasDocTag = false;
  const nodes: (LiquidDocParameter | LiquidDocExample | LiquidDocDescription)[] = visit<
    SourceCodeType.LiquidHtml,
    LiquidDocParameter | LiquidDocExample | LiquidDocDescription
  >(node, {
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
        content: handleMultilineIndentation(node.content.value.trim()),
        nodeType: 'example',
      };
    },
    LiquidDocDescriptionNode(node: LiquidDocDescriptionNode) {
      return {
        content: handleMultilineIndentation(node.content.value.trim()),
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

  if (!hasDocTag) return { type, name };

  return {
    name,
    type,
    liquidDoc: {
      ...(parameters.length && { parameters }),
      ...(examples.length && { examples }),
      ...(description && { description }),
    },
  };
}

function handleMultilineIndentation(text: string): string {
  const lines = text.split('\n');

  if (lines.length <= 1) return text;

  const nonEmptyLines = lines.slice(1).filter((line) => line.trim().length > 0);
  const indentLengths = nonEmptyLines.map((line) => {
    const match = line.match(/^\s*/);
    return match ? match[0].length : 0;
  });

  if (indentLengths.length === 0) return text;

  const minIndent = Math.min(...indentLengths);

  return [
    lines[0],
    ...lines.slice(1).map((line) => {
      if (line.trim().length === 0) return line; // Skip empty lines
      return line.slice(minIndent);
    }),
  ].join('\n');
}
