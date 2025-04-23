import { SourceCodeType, UriString } from '../types';
import { visit } from '../visitor';
import { LiquidHtmlNode } from '../types';
import {
  LiquidDocExampleNode,
  LiquidDocParamNode,
  LiquidDocDescriptionNode,
  LiquidDocPromptNode,
  NodeTypes,
  toLiquidHtmlAST,
} from '@shopify/liquid-html-parser';

export type GetDocDefinitionForURI = (
  uri: UriString,
  category: 'blocks' | 'snippets',
  name: string,
) => Promise<DocDefinition | undefined>;

export type DocDefinition = {
  uri: UriString;
  liquidDoc?: DocContent;
};

type DocContent = {
  parameters?: LiquidDocParameter[];
  examples?: LiquidDocExample[];
  description?: LiquidDocDescription;
  prompt?: LiquidDocPrompt;
};

interface LiquidDocNode {
  nodeType: 'param' | 'example' | 'description' | 'prompt';
}

export interface LiquidDocParameter extends LiquidDocNode {
  nodeType: 'param';
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

export function hasLiquidDoc(snippet: LiquidHtmlNode): boolean {
  let foundDocTag = false;
  visit<SourceCodeType.LiquidHtml, void>(snippet, {
    LiquidRawTag(node) {
      if (node.name === 'doc') foundDocTag = true;
    },
  });
  return foundDocTag;
}

/**
 * Parses Liquid documentation content and returns a DocDefinition.
 *
 * @param uri The URI of the file being processed
 * @param source The full source of the file
 * @param docContent The content of the doc tag to parse
 * @param offset Position offset for correct source mapping
 * @returns A DocDefinition containing the parsed documentation
 */
export function parseLiquidDoc(
  uri: UriString,
  source: string,
  docContent: string,
  offset: number = 0,
): DocDefinition {
  try {
    // Parse the doc content using toLiquidHtmlAST with docOptions
    const docAst = toLiquidHtmlAST(
      source,
      {
        allowUnclosedDocumentNode: true,
        mode: 'tolerant',
      },
      {
        content: docContent,
        offset,
      },
    );

    // Extract doc definition from our AST
    return extractDocDefinition(uri, docAst);
  } catch (error) {
    console.error('Error parsing Liquid doc content:', error);
    return { uri };
  }
}

export function extractDocDefinition(uri: UriString, ast: LiquidHtmlNode): DocDefinition {
  let hasDocTag = false;
  const nodes: (LiquidDocParameter | LiquidDocExample | LiquidDocDescription | LiquidDocPrompt)[] =
    visit<
      SourceCodeType.LiquidHtml,
      LiquidDocParameter | LiquidDocExample | LiquidDocDescription | LiquidDocPrompt
    >(ast, {
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
      LiquidDocPromptNode(node: LiquidDocPromptNode) {
        return {
          content: handleMultilineIndentation(node.content.value.trim()),
          nodeType: 'prompt',
        };
      },
    });

  if (!hasDocTag) return { uri };

  const { parameters, examples, description, prompt } = nodes.reduce(
    (acc, node) => {
      if (node.nodeType === 'param') {
        acc.parameters.push(node as LiquidDocParameter);
      } else if (node.nodeType === 'example') {
        acc.examples.push(node as LiquidDocExample);
      } else if (node.nodeType === 'description' && !acc.description) {
        acc.description = node as LiquidDocDescription;
      } else if (node.nodeType === 'prompt' && !acc.prompt) {
        acc.prompt = node as LiquidDocPrompt;
      }
      return acc;
    },
    {
      parameters: [] as LiquidDocParameter[],
      examples: [] as LiquidDocExample[],
      description: undefined as LiquidDocDescription | undefined,
      prompt: undefined as LiquidDocPrompt | undefined,
    },
  );

  return {
    uri,
    liquidDoc: {
      ...(parameters.length && { parameters }),
      ...(examples.length && { examples }),
      ...(description && { description }),
      ...(prompt && { prompt }),
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
